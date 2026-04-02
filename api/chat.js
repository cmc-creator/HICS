// api/chat.js - Vercel serverless function for HICS AI chatbot
// Provider order: Anthropic first, Gemini fallback

const SYSTEM_PROMPT = `You are NyxHICSlab Assistant, an expert HICS (Hospital Incident Command System) training AI embedded in NyxHICSlab by NyxCollective LLC.

You help healthcare staff learn HICS protocols, ICS structure, emergency procedures, triage methods, and disaster response best practices.

Guidelines:
- Answer questions clearly and concisely using correct HICS/ICS terminology
- Use markdown bold (**text**) for key terms and role names
- Structure multi-part answers with short bullet points when helpful
- If asked about something unrelated to HICS or hospital emergency management, politely redirect to your area of expertise
- Always remind users that your guidance is for training purposes and they should follow their facility's official Emergency Operations Plan for real incidents
- Do not generate any harmful, misleading, or legally sensitive medical advice`;

function normalizeHistory(history) {
  const safeHistory = Array.isArray(history) ? history.slice(-10) : [];
  return safeHistory
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
}

async function chatWithAnthropic({ message, history }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest';
  const messages = [
    ...history.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: 'user', content: message },
  ];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system: SYSTEM_PROMPT,
      messages,
      max_tokens: 700,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const text = Array.isArray(data?.content)
    ? data.content
        .filter((item) => item?.type === 'text' && typeof item?.text === 'string')
        .map((item) => item.text)
        .join('\n')
        .trim()
    : '';

  if (!text) {
    throw new Error('Anthropic returned an empty response');
  }

  return text;
}

async function chatWithGemini({ message, history }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const contents = [
    ...history.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ];

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 700,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts
        .map((part) => (typeof part?.text === 'string' ? part.text : ''))
        .join('\n')
        .trim()
    : '';

  if (!text) {
    throw new Error('Gemini returned an empty response');
  }

  return text;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history } = req.body ?? {};

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  if (message.length > 2000) {
    return res.status(400).json({ error: 'Message is too long.' });
  }

  const normalizedHistory = normalizeHistory(history);

  if (!process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'AI service not configured. Set ANTHROPIC_API_KEY or GEMINI_API_KEY.',
    });
  }

  try {
    try {
      const anthropicReply = await chatWithAnthropic({
        message: message.trim(),
        history: normalizedHistory,
      });
      if (anthropicReply) {
        return res.status(200).json({ reply: anthropicReply, provider: 'anthropic' });
      }
    } catch (anthropicError) {
      console.error('Anthropic chat error:', anthropicError);
    }

    try {
      const geminiReply = await chatWithGemini({
        message: message.trim(),
        history: normalizedHistory,
      });
      if (geminiReply) {
        return res.status(200).json({ reply: geminiReply, provider: 'gemini' });
      }
    } catch (geminiError) {
      console.error('Gemini chat error:', geminiError);
    }

    return res.status(502).json({ error: 'AI providers unavailable. Check Anthropic/Gemini credentials.' });
  } catch (err) {
    console.error('Chat handler error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
