// api/chat.js - Vercel serverless function for HICS AI chatbot
// Provider order: Anthropic first, Gemini fallback

import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from './_auth.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from './_security.js';

const SYSTEM_PROMPT = `You are NyxHICSlab Assistant, an expert HICS (Hospital Incident Command System) training AI embedded in NyxHICSlab by NyxCollective LLC.

You help healthcare staff learn HICS protocols, ICS structure, emergency procedures, triage methods, and disaster response best practices.

Guidelines:
- Answer questions clearly and concisely using correct HICS/ICS terminology
- Use markdown bold (**text**) for key terms and role names
- Structure multi-part answers with short bullet points when helpful
- If asked about something unrelated to HICS or hospital emergency management, politely redirect to your area of expertise
- Always remind users that your guidance is for training purposes and they should follow their facility's official Emergency Operations Plan for real incidents
- Do not generate any harmful, misleading, or legally sensitive medical advice`;

let anthropicClient = null;

function normalizeHistory(history) {
  const safeHistory = Array.isArray(history) ? history.slice(-10) : [];
  return safeHistory
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
}

async function chatWithAnthropic({ message, history }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }

  anthropicClient ??= new Anthropic();
  const response = await anthropicClient.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
    max_tokens: 4000,
    // Low effort keeps the widget responsive; these are short conversational answers.
    output_config: { effort: 'low' },
    system: SYSTEM_PROMPT,
    messages: [
      ...history,
      { role: 'user', content: message },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error(`Anthropic declined the request (${response.stop_details?.category ?? 'unspecified'})`);
  }

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  if (!text) {
    throw new Error(`Anthropic returned no text (stop_reason: ${response.stop_reason})`);
  }

  return text;
}

async function chatWithGemini({ message, history }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const contents = [
    ...history.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ];

  // Key goes in a header, not the URL, so it never lands in request logs.
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
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

  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  // Limit per signed-in user so one account can't run up the AI provider bill.
  if (!await enforceRateLimit(req, res, {
    scope: 'chat',
    maxRequests: 40,
    windowMs: 5 * 60 * 1000,
    identity: auth.claims.sub,
  })) {
    return;
  }

  const body = parseJsonBody(req);
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid JSON payload.' });
  }

  const validationError = validateBodyFields(body, [
    { name: 'message', required: true, type: 'string', minLength: 1, maxLength: 2000 },
  ]);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { message, history } = body;

  if (history !== undefined && !Array.isArray(history)) {
    return res.status(400).json({ error: 'history must be an array when provided.' });
  }

  if (message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  const normalizedHistory = normalizeHistory(history);

  if (!process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'The AI assistant is not configured yet.' });
  }

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

  return res.status(502).json({ error: 'The AI assistant is temporarily unavailable. Please try again shortly.' });
}
