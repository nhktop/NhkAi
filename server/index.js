import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const PORT = Number(process.env.PORT || 3001);
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.APP_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed'));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  maxAge: 600
}));
app.use(express.json({ limit: '1mb' }));
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a minute and try again.' }
}));

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 45_000, maxRetries: 1 })
  : null;

const styleInstructions = {
  'NHK Smart': 'Be a helpful, clear, accurate general-purpose assistant. Explain reasoning at an appropriate level.',
  'NHK Creative': 'Be imaginative and collaborative. Offer original ideas while staying clear and practical.',
  'NHK Code': 'Act as a careful programming assistant. Explain code clearly, prefer secure maintainable solutions, and state assumptions.'
};

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    provider: 'openai',
    configured: Boolean(openai),
    model: process.env.AI_MODEL || 'gpt-6-astra'
  });
});

app.post('/api/chat', async (req, res) => {
  const requestId = randomUUID();
  if (!openai) {
    return res.status(503).json({ error: 'AI is not configured yet. Add OPENAI_API_KEY to the server environment.', requestId });
  }

  const { messages, style } = req.body || {};
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 20) {
    return res.status(400).json({ error: 'Send between 1 and 20 conversation messages.', requestId });
  }

  const safeMessages = [];
  let totalCharacters = 0;
  for (const item of messages) {
    if (!item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string') {
      return res.status(400).json({ error: 'Each message must have a user or assistant role and text content.', requestId });
    }
    const content = item.content.trim();
    if (!content || content.length > 6000) {
      return res.status(400).json({ error: 'Each message must contain 1–6000 characters.', requestId });
    }
    totalCharacters += content.length;
    safeMessages.push({ role: item.role, content });
  }
  if (totalCharacters > 20000 || safeMessages.at(-1)?.role !== 'user') {
    return res.status(400).json({ error: 'The conversation is too long or the last message is not from the user.', requestId });
  }

  const selectedStyle = styleInstructions[style] ? style : 'NHK Smart';
  try {
    const response = await openai.responses.create({
      model: process.env.AI_MODEL || 'gpt-6-astra',
      instructions: [
        'You are NHK AI, a friendly and capable assistant.',
        'Be honest about uncertainty. Never claim to have performed actions you did not perform.',
        'Give safe, age-appropriate help and avoid graphic or explicit content.',
        styleInstructions[selectedStyle]
      ].join('\n'),
      input: safeMessages,
      max_output_tokens: 1200,
      store: false
    });

    const answer = response.output_text?.trim();
    if (!answer) {
      console.error(JSON.stringify({ event: 'empty_model_response', requestId, responseId: response.id }));
      return res.status(502).json({ error: 'The AI returned an empty response. Please try again.', requestId });
    }
    return res.json({ reply: answer, requestId, model: process.env.AI_MODEL || 'gpt-6-astra' });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'openai_request_failed',
      requestId,
      status: error?.status || null,
      code: error?.code || null,
      message: String(error?.message || 'Unknown error').slice(0, 300)
    }));
    const status = error?.status === 429 ? 429 : 502;
    return res.status(status).json({
      error: status === 429
        ? 'The AI service is busy or the API project has reached its usage limit. Try again later.'
        : 'NHK AI could not get a response from the AI service. Check the server configuration and try again.',
      requestId
    });
  }
});

if (isProduction) {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const distDir = path.resolve(currentDir, '../dist');
  if (existsSync(distDir)) {
    app.use(express.static(distDir, { maxAge: '1h', index: false }));
    app.get(/.*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
  }
}

app.listen(PORT, () => {
  console.log(`NHK AI server listening on port ${PORT}`);
  if (!openai) console.warn('OPENAI_API_KEY is not configured; /api/chat will return 503.');
});
