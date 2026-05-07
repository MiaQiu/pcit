'use strict';

// AI coaching chat route — Gemini function-calling agent
const express = require('express');
const fetch   = require('node-fetch');
const { requireAuth }    = require('../middleware/auth.cjs');
const { logLLMCall }          = require('../llm/logger.cjs');
const { sendLLMFailureAlert } = require('../llm/alertEmail.cjs');
const prisma             = require('../services/db.cjs');
const { subscribe, publish } = require('../services/chatBus.cjs');
const agentBus = require('../services/agentBus.cjs');

const router = express.Router();
router.use(requireAuth);

const MODEL           = 'gemini-3-pro-preview';
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
5. Add developmental psychology insights and explain from the child's perspective where appropriate.
6. When discussing skill metrics: Labeled Praises, Echo, Narrate are the skills to build (goal 10+ each). Questions, Commands, and Criticisms are the skills to reduce.`;

// ─── Tool declarations (sent to Gemini) ───────────────────────────────────────

const TOOL_DECLARATIONS = [
  {
    name: 'get_child_parent_profile',
    description: "Retrieve the two most recent developmental profiling snapshots for the child (summary and metadata). Call this when the parent asks about their child's developmental profile or progress.",
    parameters: { type: 'OBJECT', properties: {}, required: [] },
  },
  {
    name: 'get_child_milestone',
    description: "Retrieve the child's developmental milestone progress across 5 domains (Language, Cognitive, Social, Emotional, Connection) as shown in the radar chart. Returns achieved, emerging, and total milestones per domain, plus the age-appropriate benchmark and the child's age in months.",
    parameters: { type: 'OBJECT', properties: {}, required: [] },
  },
  {
    name: 'get_transcript',
    description: "Retrieve the full transcript of the parent's most recent emotional massage session, with each utterance tagged by speaker and PCIT code. Call this when the parent asks about what happened in their last session or wants specific feedback on what was said.",
    parameters: { type: 'OBJECT', properties: {}, required: [] },
  },
  {
    name: 'get_recent_sessions',
    description: "Retrieve recent emotional massage (play) session data including date, duration, overall score, and skill counts (praises, reflections, narrations, questions, commands, criticisms). Call this when the parent asks about recent sessions, their performance, or their scores.",
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: { type: 'NUMBER', description: 'Number of recent sessions to retrieve (1–10, default 2)' },
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


async function toolGetChildMilestone(userId) {
  const child = await prisma.child.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, birthday: true },
  });
  if (!child) return { error: 'No child record found' };

  // Age in months
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { childBirthday: true, childBirthYear: true },
  });
  let childAgeMonths = 0;
  const birthday = child.birthday || user?.childBirthday || null;
  if (birthday) {
    const now = new Date();
    const bd  = new Date(birthday);
    childAgeMonths = (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
  } else if (user?.childBirthYear) {
    childAgeMonths = (new Date().getFullYear() - user.childBirthYear) * 12 + 6;
  }

  const [allMilestones, childMilestones] = await Promise.all([
    prisma.milestoneLibrary.findMany({
      orderBy: [{ category: 'asc' }, { medianAgeMonths: 'asc' }],
    }),
    prisma.childMilestone.findMany({
      where: { childId: child.id },
      include: { MilestoneLibrary: true },
    }),
  ]);

  const parseAgeRange = (groupingStage) => {
    const match = groupingStage.match(/\((\d+)-?(\d+)?m?\+?\)/);
    if (match) return { start: parseInt(match[1], 10), end: match[2] ? parseInt(match[2], 10) : 84 };
    return { start: 0, end: 84 };
  };

  // Group library milestones by domain → stage
  const byDomainStage = {};
  for (const m of allMilestones) {
    (byDomainStage[m.category] ??= {})[m.groupingStage] ??= [];
    byDomainStage[m.category][m.groupingStage].push(m);
  }

  const calculateBenchmark = (category) => {
    const stages = byDomainStage[category];
    if (!stages) return 0;
    let benchmark = 0;
    const entries = Object.entries(stages)
      .map(([stage, ms]) => ({ range: parseAgeRange(stage), count: ms.length }))
      .sort((a, b) => a.range.start - b.range.start);
    for (const { range, count } of entries) {
      if (childAgeMonths >= range.end) {
        benchmark += count;
      } else if (childAgeMonths >= range.start) {
        benchmark += count * (childAgeMonths - range.start) / (range.end - range.start);
      }
    }
    return Math.round(benchmark * 100) / 100;
  };

  const domains = ['Language', 'Cognitive', 'Social', 'Emotional', 'Connection'];
  const result = {};
  for (const domain of domains) {
    const total    = allMilestones.filter(m => m.category === domain).length;
    const achieved = childMilestones.filter(cm => cm.MilestoneLibrary.category === domain && cm.status === 'ACHIEVED').length;
    const emerging = childMilestones.filter(cm => cm.MilestoneLibrary.category === domain && cm.status === 'EMERGING').length;
    result[domain] = { achieved, emerging, total, benchmark: calculateBenchmark(domain) };
  }

  return { childAgeMonths, domains: result };
}

async function toolGetTranscript(userId) {
  const session = await prisma.session.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true },
  });
  if (!session) return { error: 'No sessions found' };

  const utterances = await prisma.utterance.findMany({
    where: { sessionId: session.id },
    orderBy: { order: 'asc' },
    select: { text: true, role: true, pcitTag: true },
  });

  return {
    sessionDate: session.createdAt.toISOString().slice(0, 10),
    transcript: utterances.map(u => ({
      role: u.role ?? null,
      text: u.text,
      pcitTag: u.pcitTag ?? null,
    })),
  };
}

async function executeTool(name, args, userId) {
  switch (name) {
    case 'get_child_parent_profile': return toolGetChildParentProfile(userId);
    case 'get_child_milestone':      return toolGetChildMilestone(userId);
    case 'get_recent_sessions':      return toolGetRecentSessions(userId, args?.limit);
    case 'get_transcript':           return toolGetTranscript(userId);
    default:                         return { error: `Unknown tool: ${name}` };
  }
}

// ─── Tool → status text (shown to user while tool executes) ──────────────────

const TOOL_STATUS = {
  get_recent_sessions:      'Reviewing recent play sessions...',
  get_child_milestone:      "Understanding your child’s stage...",
  get_child_parent_profile: 'Personalizing your answer...',
  get_transcript:           'Reviewing recent play sessions...',
};

// ─── Gemini agent loop ────────────────────────────────────────────────────────

async function runAgentLoop(userId, userText, dbHistory, signal) {
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
    if (turn === 0) publish(userId, [{ type: 'status', text: 'Thinking...' }]);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    // Also abort if the external signal fires (e.g. admin stopped the request)
    signal?.addEventListener('abort', () => controller.abort(), { once: true });

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

    const statuses = fnParts.map(p => ({
      type: 'status',
      text: TOOL_STATUS[p.functionCall.name] ?? 'Looking something up...',
    }));
    publish(userId, statuses);

    // Execute tools (in parallel) and append results
    const responseParts = await Promise.all(
      fnParts.map(async p => {
        const result = await executeTool(p.functionCall.name, p.functionCall.args ?? {}, userId);
        return { functionResponse: { name: p.functionCall.name, response: { result } } };
      })
    );
    contents.push({ role: 'user', parts: responseParts });
    publish(userId, [{ type: 'status', text: 'Almost ready...' }]);
  }

  throw new Error('Agent exceeded maximum tool-call turns without producing a reply');
}

// ─── Claude Sonnet fallback agent loop (full tool use) ────────────────────────

const CLAUDE_FALLBACK_MODEL = 'claude-sonnet-4-6';

// Convert Gemini tool declarations → Claude format (input_schema, lowercase types)
const CLAUDE_TOOLS = TOOL_DECLARATIONS.map(t => ({
  name:        t.name,
  description: t.description,
  input_schema: {
    type:       t.parameters.type.toLowerCase(),
    properties: Object.fromEntries(
      Object.entries(t.parameters.properties).map(([k, v]) => [
        k, { ...v, type: v.type.toLowerCase() },
      ])
    ),
    required: t.parameters.required,
  },
}));

async function runClaudeAgentLoop(userId, userText, dbHistory, signal) {
  // Build messages array; Claude requires strict user/assistant alternation.
  // Merge consecutive same-role messages and drop leading assistant turns.
  const rawMessages = [
    ...dbHistory.map(m => ({
      role:    (m.role === 'model' || m.role === 'psychologist') ? 'assistant' : 'user',
      content: m.text,
    })),
    { role: 'user', content: userText },
  ];

  const messages = [];
  for (const msg of rawMessages) {
    if (messages.length === 0 && msg.role === 'assistant') continue; // must start with user
    const prev = messages[messages.length - 1];
    if (prev && prev.role === msg.role) {
      prev.content += '\n' + msg.content; // merge consecutive same-role
    } else {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  const apiUrl = 'https://api.anthropic.com/v1/messages';
  const headers = {
    'Content-Type':      'application/json',
    'x-api-key':         process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
  };

  let totalInput  = 0;
  let totalOutput = 0;

  for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
    if (turn === 0) publish(userId, [{ type: 'status', text: 'Thinking...' }]);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    signal?.addEventListener('abort', () => controller.abort(), { once: true });

    let raw;
    try {
      raw = await fetch(apiUrl, {
        method:  'POST',
        headers,
        body: JSON.stringify({
          model:       CLAUDE_FALLBACK_MODEL,
          system:      SYSTEM_PROMPT,
          tools:       CLAUDE_TOOLS,
          messages,
          max_tokens:  2048,
          temperature: 0.8,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!raw.ok) {
      const errText = await raw.text().catch(() => '');
      throw Object.assign(
        new Error(`Claude API error ${raw.status}: ${errText.slice(0, 200)}`),
        { status: raw.status }
      );
    }

    const data       = await raw.json();
    totalInput  += data.usage?.input_tokens  ?? 0;
    totalOutput += data.usage?.output_tokens ?? 0;

    const content    = data.content ?? [];
    const textBlock  = content.find(b => b.type === 'text');
    const toolBlocks = content.filter(b => b.type === 'tool_use');

    if (data.stop_reason === 'end_turn' || toolBlocks.length === 0) {
      return {
        text:  textBlock?.text ?? '',
        usage: { inputTokens: totalInput, outputTokens: totalOutput },
      };
    }

    // Append assistant's tool-call turn, then execute tools in parallel
    messages.push({ role: 'assistant', content });

    const statuses = toolBlocks.map(b => ({
      type: 'status',
      text: TOOL_STATUS[b.name] ?? 'Looking something up...',
    }));
    publish(userId, statuses);

    const toolResults = await Promise.all(
      toolBlocks.map(async b => {
        const result = await executeTool(b.name, b.input ?? {}, userId);
        return { type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(result) };
      })
    );
    messages.push({ role: 'user', content: toolResults });
    publish(userId, [{ type: 'status', text: 'Almost ready...' }]);
  }

  throw new Error('Claude agent exceeded maximum tool-call turns without producing a reply');
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/coach/unread?since=<ISO>&thread=ai|psych
 * Returns the count of unread messages.
 * thread=ai   → only model messages
 * thread=psych → only psychologist messages
 * (default)   → all non-user, non-user_psych messages
 */
router.get('/unread', async (req, res, next) => {
  try {
    const since  = req.query.since  ? new Date(req.query.since) : new Date(0);
    const thread = req.query.thread;

    let roleFilter;
    if (thread === 'ai')    roleFilter = { equals: 'model' };
    else if (thread === 'psych') roleFilter = { equals: 'psychologist' };
    else                    roleFilter = { notIn: ['user', 'user_psych'] };

    const [count, lastMsg] = await Promise.all([
      prisma.coachChatMessage.count({
        where: { userId: req.userId, role: roleFilter, createdAt: { gt: since } },
      }),
      prisma.coachChatMessage.findFirst({
        where: { userId: req.userId, role: roleFilter },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);
    res.json({ count, lastMessageAt: lastMsg?.createdAt ?? null });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/coach/psych-message
 * Body: { message: string }
 * Saves a parent message directed at the psychologist (role: user_psych).
 * Does NOT trigger the AI agent.
 */
router.post('/psych-message', async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }
    const msg = await prisma.coachChatMessage.create({
      data: { userId: req.userId, role: 'user_psych', text: message.trim() },
      select: { id: true, role: true, text: true, createdAt: true },
    });
    publish(req.userId, [msg]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/coach/events?since=<ISO timestamp>
 * Long-poll endpoint. Holds the request until a new message arrives for this user
 * or 25 seconds elapse (client should immediately retry on empty response).
 */
router.get('/events', async (req, res, next) => {
  try {
    const since = req.query.since ? new Date(req.query.since) : new Date();

    // Respond immediately if messages already exist since the timestamp
    const pending = await prisma.coachChatMessage.findMany({
      where: { userId: req.userId, createdAt: { gt: since } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, text: true, createdAt: true },
    });

    if (pending.length > 0) {
      return res.json({ messages: pending });
    }

    // Otherwise hold until publish() fires or timeout
    const unsubscribe = subscribe(req.userId, (messages) => {
      if (!res.headersSent) res.json({ messages });
    });

    req.on('close', unsubscribe);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/coach/history
 * Returns chat history oldest-first.
 * - With ?since=<ISO>: messages newer than that timestamp (incremental sync).
 * - Without since: messages within 1 day before the user's most recent message
 *   (i.e. the last conversation window).
 */
router.get('/history', async (req, res, next) => {
  try {
    let since = req.query.since ? new Date(req.query.since) : undefined;

    if (!since) {
      const latest = await prisma.coachChatMessage.findFirst({
        where: { userId: req.userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (latest) {
        since = new Date(latest.createdAt.getTime() - 24 * 60 * 60 * 1000);
      }
    }

    const messages = await prisma.coachChatMessage.findMany({
      where: {
        userId: req.userId,
        ...(since ? { createdAt: { gte: since } } : {}),
      },
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

    // Save & publish the user message immediately so admin sees it without waiting for LLM
    const userMsg = await prisma.coachChatMessage.create({
      data: { userId: req.userId, role: 'user', text: userText },
      select: { id: true, role: true, text: true, createdAt: true },
    });
    publish(req.userId, [userMsg]);

    // Load conversation history for LLM context
    const dbHistory = await prisma.coachChatMessage.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: MAX_HISTORY_MESSAGES,
      select: { role: true, text: true },
    });
    dbHistory.reverse();

    const abortController = new AbortController();
    agentBus.setActive(req.userId, abortController);

    const start = Date.now();
    let result;
    let usedRetry    = false;
    let usedFallback = false;
    let provider     = 'gemini';
    let model        = MODEL;

    const isUserAbort = () => abortController.signal.aborted;

    try {
      result = await runAgentLoop(req.userId, userText, dbHistory, abortController.signal);
    } catch (firstErr) {
      if (firstErr.name === 'AbortError' && isUserAbort()) {
        agentBus.clear(req.userId);
        return res.status(200).json({ reply: null, aborted: true });
      }

      if (firstErr.name !== 'AbortError') {
        agentBus.clear(req.userId);
        logLLMCall({
          label: 'coach-chat', model, provider,
          latencyMs: Date.now() - start,
          inputTokens: null, outputTokens: null,
          hasSchema: false, usedFallback: false, usedRepair: false, usedRetry: false,
          ok: false, error: firstErr.message,
        });
        throw firstErr;
      }

      // Gemini timed out — retry once silently
      usedRetry = true;
      logLLMCall({
        label: 'coach-chat', model, provider,
        latencyMs: Date.now() - start,
        inputTokens: null, outputTokens: null,
        hasSchema: false, usedFallback: false, usedRepair: false, usedRetry: true,
        ok: false, error: firstErr.message,
      });

      try {
        result = await runAgentLoop(req.userId, userText, dbHistory, abortController.signal);
      } catch (retryErr) {
        if (retryErr.name === 'AbortError' && isUserAbort()) {
          agentBus.clear(req.userId);
          return res.status(200).json({ reply: null, aborted: true });
        }

        // Gemini still failing — fallback to Claude Sonnet
        usedFallback = true;
        provider     = 'anthropic';
        model        = CLAUDE_FALLBACK_MODEL;
        logLLMCall({
          label: 'coach-chat', model: MODEL, provider: 'gemini',
          latencyMs: Date.now() - start,
          inputTokens: null, outputTokens: null,
          hasSchema: false, usedFallback: true, usedRepair: false, usedRetry: true,
          ok: false, error: retryErr.message,
        });

        try {
          result = await runClaudeAgentLoop(req.userId, userText, dbHistory, abortController.signal);
        } catch (claudeErr) {
          agentBus.clear(req.userId);
          logLLMCall({
            label: 'coach-chat', model, provider,
            latencyMs: Date.now() - start,
            inputTokens: null, outputTokens: null,
            hasSchema: false, usedFallback: true, usedRepair: false, usedRetry: true,
            ok: false, error: claudeErr.message,
          });
          sendLLMFailureAlert({
            label: 'coach-chat', model, error: claudeErr.message,
            to: 'info@chromamind.ai',
          });
          const sorryText = "I'm having some trouble right now and couldn't process your message. Please try again in a moment, or tap \"Talk to a Psychologist\" if you need immediate support.";
          const sorryMsg = await prisma.coachChatMessage.create({
            data: { userId: req.userId, role: 'model', text: sorryText },
            select: { id: true, role: true, text: true, createdAt: true },
          });
          publish(req.userId, [sorryMsg]);
          return res.json({ reply: sorryText });
        }
      }
    }

    agentBus.clear(req.userId);

    logLLMCall({
      label: 'coach-chat', model, provider,
      latencyMs: Date.now() - start,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      hasSchema: false, usedFallback, usedRepair: false, usedRetry,
      ok: true, error: null,
    });

    const reply = result.text.trim();

    const modelMsg = await prisma.coachChatMessage.create({
      data: { userId: req.userId, role: 'model', text: reply },
      select: { id: true, role: true, text: true, createdAt: true },
    });
    publish(req.userId, [modelMsg]);

    res.json({ reply });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
