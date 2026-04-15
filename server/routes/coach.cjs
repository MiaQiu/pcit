'use strict';

// AI coaching chat route — Gemini function-calling agent
const express = require('express');
const fetch   = require('node-fetch');
const { requireAuth } = require('../middleware/auth.cjs');
const { logLLMCall }  = require('../llm/logger.cjs');
const prisma          = require('../services/db.cjs');

const router = express.Router();
router.use(requireAuth);

const MODEL           = 'gemini-2.5-pro-preview-05-06';
const MAX_AGENT_TURNS = 6;          // tool-call rounds before giving up
const MAX_HISTORY_MESSAGES = 20;    // conversation turns sent to LLM

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `**ROLE & OBJECTIVE**

You are an expert Child Psychologist and PCIT (Parent-Child Interaction Therapy) Therapist acting as an AI coaching assistant for parents using the Nora app. Your goal is to answer parents' questions with empathy, clinical insight, and personalised context retrieved from the database.

**Instructions**
1. Use your tools to retrieve relevant data before answering — you do not need to call all tools for every message; decide which data is actually relevant.
2. Strictly do not answer questions that are out of scope. State your limitation as AI. If something requires a human professional, advise the parent to tap "Talk to a Psychologist".
3. We have branded the special time as "emotional massage" and the score is a deposit to their "emotional bank account". Do not mention PCIT in conversation with parents.
4. Reply in a way that is easy to read on a mobile screen (no tables, no emoji). Sound like a warm, human therapist.
5. When discussing skill metrics: Labeled Praises, Reflections, Behavioral Descriptions are the skills to build (goal 10+ each). Questions, Commands, and Criticisms are the skills to reduce.`;

// ─── Tool declarations (sent to Gemini) ───────────────────────────────────────

const TOOL_DECLARATIONS = [
  {
    name: 'get_child_parent_profile',
    description: "Retrieve the two most recent developmental profiling snapshots for the child (summary and metadata). Call this when the parent asks about their child's developmental profile or progress.",
    parameters: { type: 'OBJECT', properties: {}, required: [] },
  },
  {
    name: 'get_recent_sessions',
    description: "Retrieve recent emotional massage (play) session data including date, duration, overall score, and skill counts (praises, reflections, narrations, questions, commands, criticisms). Call this when the parent asks about recent sessions, their performance, or their scores.",
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: { type: 'NUMBER', description: 'Number of recent sessions to retrieve (1–10, default 5)' },
      },
      required: [],
    },
  },
];

// ─── Tool implementations (DB queries) ────────────────────────────────────────

async function toolGetChildParentProfile(userId) {
  const child = await prisma.child.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  if (!child?.id) return { profilingSnapshots: [] };

  const snapshots = await prisma.childProfiling.findMany({
    where: { childId: child.id },
    orderBy: { createdAt: 'desc' },
    take: 2,
    select: { createdAt: true, summary: true, metadata: true },
  });

  return {
    profilingSnapshots: snapshots.map(p => ({
      date: p.createdAt.toISOString().slice(0, 10),
      summary: p.summary ?? null,
      metadata: p.metadata ?? null,
    })),
  };
}

async function toolGetRecentSessions(userId, limit = 5) {
  const n = Math.min(Math.max(1, Number(limit) || 5), 10);
  const sessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: n,
    select: {
      id: true,
      createdAt: true,
      durationSeconds: true,
      overallScore: true,
      tagCounts: true,
      coachingSummary: true,
      coachingCards: true,
    },
  });
  return sessions.map((s, idx) => {
    const tc = (s.tagCounts && typeof s.tagCounts === 'object') ? s.tagCounts : {};
    return {
      date: s.createdAt.toISOString().slice(0, 10),
      durationMinutes: Math.round((s.durationSeconds || 0) / 60),
      overallScore: s.overallScore ?? null,
      skills: {
        labeledPraises:         tc.praise    ?? 0,
        reflections:            tc.echo      ?? 0,
        behavioralDescriptions: tc.narration ?? 0,
        questions:              tc.question  ?? 0,
        commands:               tc.command   ?? 0,
        criticisms:             tc.criticism ?? 0,
      },
      coachingSummary: s.coachingSummary || null,
      // Include coachingCards for the two most recent sessions only
      coachingCards: idx < 2 ? (s.coachingCards ?? null) : undefined,
    };
  });
}


async function executeTool(name, args, userId) {
  switch (name) {
    case 'get_child_parent_profile': return toolGetChildParentProfile(userId);
    case 'get_recent_sessions':  return toolGetRecentSessions(userId, args?.limit);
    default:                     return { error: `Unknown tool: ${name}` };
  }
}

// ─── Gemini agent loop ────────────────────────────────────────────────────────

async function runAgentLoop(userId, userText, dbHistory) {
  const contents = [
    ...dbHistory.map(m => ({
      role: m.role === 'model' || m.role === 'psychologist' ? 'model' : 'user',
      parts: [{ text: m.text }],
    })),
    { role: 'user', parts: [{ text: userText }] },
  ];

  const baseBody = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    tools: [{ function_declarations: TOOL_DECLARATIONS }],
    generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
  };

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  let totalInput = 0;
  let totalOutput = 0;

  for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    let raw;
    try {
      raw = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...baseBody, contents }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!raw.ok) {
      const errText = await raw.text().catch(() => '');
      throw Object.assign(new Error(`Gemini API error ${raw.status}: ${errText.slice(0, 200)}`), { status: raw.status });
    }

    const data = await raw.json();
    totalInput  += data.usageMetadata?.promptTokenCount     ?? 0;
    totalOutput += data.usageMetadata?.candidatesTokenCount ?? 0;

    const parts  = data.candidates?.[0]?.content?.parts ?? [];
    const textPart = parts.find(p => typeof p.text === 'string');
    const fnParts  = parts.filter(p => p.functionCall);

    if (textPart) {
      return { text: textPart.text, usage: { inputTokens: totalInput, outputTokens: totalOutput } };
    }

    if (fnParts.length === 0) {
      throw new Error('Gemini returned no text and no function calls');
    }

    // Append model's tool-call turn
    contents.push({ role: 'model', parts: fnParts });

    // Execute tools (in parallel) and append results
    const responseParts = await Promise.all(
      fnParts.map(async p => {
        const result = await executeTool(p.functionCall.name, p.functionCall.args ?? {}, userId);
        return { functionResponse: { name: p.functionCall.name, response: { result } } };
      })
    );
    contents.push({ role: 'user', parts: responseParts });
  }

  throw new Error('Agent exceeded maximum tool-call turns without producing a reply');
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/coach/history
 * Returns the authenticated user's full chat history (all roles), oldest first.
 */
router.get('/history', async (req, res, next) => {
  try {
    const messages = await prisma.coachChatMessage.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, text: true, createdAt: true },
    });
    res.json({ messages });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/coach/chat
 * Body: { message: string }
 * Returns: { reply: string }
 */
router.post('/chat', async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }
    const userText = message.trim();

    // Load conversation history (exclude psychologist messages from LLM context)
    const dbHistory = await prisma.coachChatMessage.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: MAX_HISTORY_MESSAGES,
      select: { role: true, text: true },
    });
    dbHistory.reverse();

    const start = Date.now();
    let result;
    try {
      result = await runAgentLoop(req.userId, userText, dbHistory);
    } catch (llmErr) {
      logLLMCall({
        label: 'coach-chat', model: MODEL, provider: 'gemini',
        latencyMs: Date.now() - start,
        inputTokens: null, outputTokens: null,
        hasSchema: false, usedFallback: false, usedRepair: false, usedRetry: false,
        ok: false, error: llmErr.message,
      });
      throw llmErr;
    }

    logLLMCall({
      label: 'coach-chat', model: MODEL, provider: 'gemini',
      latencyMs: Date.now() - start,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      hasSchema: false, usedFallback: false, usedRepair: false, usedRetry: false,
      ok: true, error: null,
    });

    const reply = result.text.trim();

    await prisma.coachChatMessage.createMany({
      data: [
        { userId: req.userId, role: 'user',  text: userText },
        { userId: req.userId, role: 'model', text: reply },
      ],
    });

    res.json({ reply });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
