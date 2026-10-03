import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { buildSystemPrompt, buildMessages } from './lib/prompt.js';
import { checkPromptPolicy, validateRequestBody, extractProposedChanges } from './lib/policy.js';
import { extractUpstreamMessage, getOpenRouterModels } from '../shared/assistant-upstream.js';

// Load the single repository-root env file regardless of the current directory.
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const app = express();
const PORT = process.env.PORT || 3001;
const RATE_LIMIT_MAX = parseInt(process.env.ASSISTANT_RATE_LIMIT, 10) || 20;

app.use(helmet());
app.use(cors());

// Rate limiting: ASSISTANT_MAX requests per 15-minute window (default 20)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Please try again later.' },
});
app.use('/api/assistant/', limiter);

app.use(express.json({ limit: '200kb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/assistant/query', async (req, res) => {
  const bodyError = validateRequestBody(req.body);
  if (bodyError) return res.status(bodyError.status).json({ error: bodyError.error });

  const { question, contextSummary, sendExact, messages: conversationMessages } = req.body;

  const policyError = conversationMessages
    .filter((message) => message.role === 'user')
    .map((message) => checkPromptPolicy(message.content))
    .find(Boolean);
  if (policyError) return res.status(policyError.status).json({ error: policyError.error });

  const apiKey = process.env.OPENROUTER_API_KEY;
  const apiUrl = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
  if (!apiKey) {
    return res.status(500).json({ error: 'OpenRouter API key not configured.' });
  }

  const systemPrompt = buildSystemPrompt(contextSummary);
  const models = getOpenRouterModels(process.env.OPENROUTER_FALLBACK_MODELS);

  // Logging: metadata only - never raw portfolio context or replies
  const startedAt = Date.now();
  try {
    const openRouterResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://fire-os-dd6d6.web.app',
        'X-OpenRouter-Title': 'FIRE OS',
      },
      body: JSON.stringify({
        models,
        messages: buildMessages(systemPrompt, conversationMessages),
        max_tokens: 180,
        stream: false,
      }),
    });

    if (!openRouterResponse.ok) {
      const errText = await openRouterResponse.text();
      const upstreamMessage = extractUpstreamMessage(errText);
      console.error(
        JSON.stringify({
          event: 'openrouter_error',
          status: openRouterResponse.status,
          models,
          latencyMs: Date.now() - startedAt,
          detail: (upstreamMessage || errText).slice(0, 200),
        }),
      );
      const detail = upstreamMessage ? `: ${upstreamMessage.slice(0, 200)}` : '';
      return res.status(502).json({ error: `LLM backend error${detail}` });
    }

    const data = await openRouterResponse.json();
    const reply =
      data?.choices?.[0]?.message?.content ??
      (typeof data?.content === 'string' ? data.content : '');
    const proposedChanges = extractProposedChanges(reply);

    console.log(
      JSON.stringify({
        event: 'assistant_query',
        model: data?.model || models[0],
        latencyMs: Date.now() - startedAt,
        hasProposal: proposedChanges !== null,
        sendExact: sendExact === true,
        questionChars: question.length,
      }),
    );

    res.json({ reply, ...(proposedChanges ? { proposedChanges } : {}) });
  } catch (err) {
    console.error(
      JSON.stringify({
        event: 'assistant_proxy_error',
        latencyMs: Date.now() - startedAt,
        detail: String(err?.message ?? err).slice(0, 200),
      }),
    );
    res.status(500).json({ error: 'Internal proxy error' });
  }
});

// Local dev server; Firebase Functions runs the app via index.js (FIREBASE_CONFIG set there)
if (process.env.NODE_ENV !== 'test' && !process.env.FIREBASE_CONFIG) {
  app.listen(PORT, () => {
    console.log(`FIRE OS Assistant proxy running on http://localhost:${PORT}`);
  });
}

export default app;
