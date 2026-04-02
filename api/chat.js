// api/chat.js - Vercel serverless function for HICS AI chatbot
// Requires: OPENAI_API_KEY environment variable

const SYSTEM_PROMPT = `You are NyxHICSlab Assistant, an expert HICS (Hospital Incident Command System) training AI embedded in NyxHICSlab by NyxCollective LLC.

You help healthcare staff learn HICS protocols, ICS structure, emergency procedures, triage methods, and disaster response best practices.

Guidelines:
- Answer questions clearly and concisely using correct HICS/ICS terminology
- Use markdown bold (**text**) for key terms and role names
- Structure multi-part answers with short bullet points when helpful
- If asked about something unrelated to HICS or hospital emergency management, politely redirect to your area of expertise
- Always remind users that your guidance is for training purposes and they should follow their facility's official Emergency Operations Plan for real incidents
- Do not generate any harmful, misleading, or legally sensitive medical advice`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI service not configured. Contact your administrator.' });
  }

  const { message, history } = req.body ?? {};

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  if (message.length > 2000) {
    return res.status(400).json({ error: 'Message is too long.' });
  }

  // Build messages array: system prompt + recent history + current user message
  const safeHistory = Array.isArray(history) ? history.slice(-10) : [];
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...safeHistory
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) })),
    { role: 'user', content: message.trim() },
  ];

  try {
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 600,
        temperature: 0.4,
      }),
    });

    if (!openAiResponse.ok) {
      const errorBody = await openAiResponse.text();
      console.error('OpenAI API error:', openAiResponse.status, errorBody);
      return res.status(502).json({ error: 'AI service temporarily unavailable. Please try again.' });
    }

    const data = await openAiResponse.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.status(502).json({ error: 'No response from AI service.' });
    }

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Chat handler error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
