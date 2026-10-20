'use strict';

// AI coaching chat route — Gemini function-calling agent
const express = require('express');
const fetch   = require('node-fetch');
const { requireAuth }    = require('../middleware/auth.cjs');
const { logLLMCall }          = require('../llm/logger.cjs');
const { sendLLMFailureAlert } = require('../llm/alertEmail.cjs');
const { Prisma }         = require('@prisma/client');
const prisma             = require('../services/db.cjs');
const { subscribe, publish } = require('../services/chatBus.cjs');
const agentBus = require('../services/agentBus.cjs');
const { getModuleChatPrompt, LEARN_MODULE_KEYS } = require('../services/pcitAnalysisService.cjs');
const { prepareOfferReply, recordOffer, respondToOffer } = require('../services/specialPlayOffer.cjs');

const router = express.Router();
router.use(requireAuth);

const MODEL           = process.env.GEMINI_STREAMING_MODEL || 'gemini-3.1-pro-preview';
// Learn module chats: short, scoped check-ins — a fast flash model.
const MODULE_CHAT_MODEL = process.env.GEMINI_MODULE_CHAT_MODEL || 'gemini-3.8-flash';
const MAX_AGENT_TURNS = 6;          // tool-call rounds before giving up
const MAX_HISTORY_MESSAGES = 20;    // conversation turns sent to LLM

// ─── System prompt ────────────────────────────────────────────────────────────

const BASE_SYSTEM_PROMPT = `**ROLE & OBJECTIVE**

You are an expert Child Psychologist and PCIT (Parent-Child Interaction Therapy) Therapist acting as an AI coaching assistant for parents using the Nora app. Your goal is to answer parents' questions with empathy, clinical insight, and personalised context retrieved from the database.

**Instructions**
1. Use your tools to retrieve relevant data before answering — you do not need to call all tools for every message; decide which data is actually relevant.
2. Strictly do not answer questions that are out of scope. State your limitation as AI. If something requires a human professional, advise the parent to tap "Talk to a Psychologist".
3. We have branded the special time as "emotional massage" and the score is a deposit to their "emotional bank account". Do not mention PCIT in conversation with parents.
4. Reply in a way that is easy to read on a mobile screen (no tables, no emoji). Sound like a warm, human therapist.
5. Add developmental psychology insights and explain from the child's perspective where appropriate.
6. When discussing skill metrics: Labeled Praises, Echo, Narrate are the skills to build (goal 10+ each). Questions, Commands, and Criticisms are the skills to reduce.`;

const LOCALE_NAMES = {
  'en':    'English',
  'zh-TW': 'Traditional Chinese (Taiwan)',
  'zh-CN': 'Simplified Chinese (Mainland China)',
};

function buildSystemPrompt(locale) {
  const langName = LOCALE_NAMES[locale] || LOCALE_NAMES['en'];
  if (langName === LOCALE_NAMES['en']) return BASE_SYSTEM_PROMPT;
  let prompt = `${BASE_SYSTEM_PROMPT}
7. Always reply in ${langName}. Do not switch to another language even if the parent writes in a different language.`;
  if (locale === 'zh-TW') {
    prompt += '\n8. When referring to skill names in Chinese, use: Echo → 回應, Narrate → 行為描述, Labeled Praise → 具體讚美.';
  }
  if (locale === 'zh-CN') {
    prompt += '\n8. When referring to skill names in Chinese, use: Echo → 回应, Narrate → 行为描述, Labeled Praise → 具体赞美.';
  }
  return prompt;
}

// Learn module chat (body.moduleKey): the module's own scoped prompt (e.g.
// prompts/coach-screentime.txt, filled with the family's context) plus the
// reply-language rule.
function buildModuleSystemPrompt(modulePrompt, locale) {
  const langName = LOCALE_NAMES[locale] || LOCALE_NAMES['en'];
  if (langName === LOCALE_NAMES['en']) return modulePrompt;
  return `${modulePrompt}
**LANGUAGE**
Always reply in ${langName}, including the OPTIONS line. Do not switch to another language even if the parent writes in a different language.`;
}

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

// Learn module chat tools. The family's context is already in the module
// prompt, so the tools only write: the strategy check-in's outcome (fed into
// the next module report, moduleStrategyFeedbackNotes) and the parent's
// typed answer to a special play time offer (services/specialPlayOffer.cjs).
const MODULE_TOOL_DECLARATIONS = [
  {
    name: 'answer_special_play_offer',
    description: "Record the parent's answer when they TYPE a reply to your offer to add special play time to their home page (not needed when they tap an option — the app records that). 'accepted' adds the Play time card to their home page.",
    parameters: {
      type: 'OBJECT',
      properties: {
        response: { type: 'STRING', enum: ['accepted', 'declined'], description: "'accepted' if they want it added, 'declined' if not now" },
      },
      required: ['response'],
    },
  },
  {
    name: 'save_strategy_feedback',
    description: "Save what the parent told you about one suggested strategy during a strategy check-in. Call once per strategy, when the parent agrees on a next step or the check-in ends.",
    parameters: {
      type: 'OBJECT',
      properties: {
        strategy:  { type: 'STRING', description: 'The strategy discussed, named as in the plan or suggested strategies' },
        tried:     { type: 'STRING', enum: ['yes', 'not_yet', 'unsure'], description: "Whether the parent has tried it: 'yes', 'not_yet', or 'unsure' (wanted to clarify it before trying)" },
        outcome:   { type: 'STRING', enum: ['went_well', 'partly', 'hard'], description: 'Only when tried is yes: how it went' },
        obstacle:  { type: 'STRING', description: 'What got in the way, what was hard, or which part was unclear — in a short phrase' },
        next_step: { type: 'STRING', description: 'The one next step the parent agreed to try, if any' },
        notes:     { type: 'STRING', description: "Anything else useful for the next report (e.g. the child's reaction), in one sentence" },
      },
      required: ['strategy', 'tried'],
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

const optionalText = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 500) : null);

// One row per strategy per report period: the model may call this more than
// once in a check-in (or again later), so a strategy that already has
// feedback since the latest module report is updated — fields it didn't
// resend keep their earlier values.
async function toolSaveStrategyFeedback(userId, moduleKey, args) {
  const strategy = optionalText(args?.strategy);
  const tried = ['yes', 'not_yet', 'unsure'].includes(args?.tried) ? args.tried : null;
  if (!strategy || !tried) return { error: 'strategy and tried are required' };
  const fields = {
    tried,
    outcome:  tried === 'yes' && ['went_well', 'partly', 'hard'].includes(args.outcome) ? args.outcome : null,
    obstacle: optionalText(args.obstacle),
    nextStep: optionalText(args.next_step),
    notes:    optionalText(args.notes),
  };

  const latestReport = await prisma.session.findFirst({
    where: { userId, moduleKey, analysisStatus: 'COMPLETED', moduleCoaching: { not: Prisma.DbNull } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  const existing = await prisma.moduleStrategyFeedback.findFirst({
    where: {
      userId,
      moduleKey,
      strategy: { equals: strategy, mode: 'insensitive' },
      ...(latestReport ? { createdAt: { gt: latestReport.createdAt } } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) {
    await prisma.moduleStrategyFeedback.update({
      where: { id: existing.id },
      data: {
        tried,
        outcome:  tried === 'yes' ? (fields.outcome ?? existing.outcome) : null,
        obstacle: fields.obstacle ?? existing.obstacle,
        nextStep: fields.nextStep ?? existing.nextStep,
        notes:    fields.notes ?? existing.notes,
      },
    });
  } else {
    await prisma.moduleStrategyFeedback.create({ data: { userId, moduleKey, strategy, ...fields } });
  }
  return { saved: true };
}

async function toolAnswerSpecialPlayOffer(userId, moduleKey, args) {
  if (!['accepted', 'declined'].includes(args?.response)) return { error: "response must be 'accepted' or 'declined'" };
  return respondToOffer(userId, moduleKey, args.response, 'chat');
}

async function executeModuleTool(name, args, userId, moduleKey) {
  switch (name) {
    case 'answer_special_play_offer': return toolAnswerSpecialPlayOffer(userId, moduleKey, args);
    case 'save_strategy_feedback':    return toolSaveStrategyFeedback(userId, moduleKey, args);
    default:                          return { error: `Unknown tool: ${name}` };
  }
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
  save_strategy_feedback:   'Almost ready...',
  answer_special_play_offer: 'Almost ready...',
};

/**
 * What the agent loops run with: system prompt, tool declarations and the
 * tool executor. The main coach is the PCIT therapist with its data tools;
 * a Learn module chat (moduleKey) gets the module's scoped prompt and tools.
 */
async function buildAgent(userId, locale, moduleKey = null) {
  if (moduleKey) {
    const modulePrompt = await getModuleChatPrompt(userId, moduleKey);
    if (modulePrompt) {
      return {
        systemPrompt: buildModuleSystemPrompt(modulePrompt, locale),
        tools:        MODULE_TOOL_DECLARATIONS,
        model:        MODULE_CHAT_MODEL,
        // Short check-in replies don't need deep thinking; the default level
        // often ran past the 30s timeout and fell back to Claude.
        thinkingConfig: { thinkingLevel: 'low' },
        executeTool:  (name, args) => executeModuleTool(name, args, userId, moduleKey),
      };
    }
  }
  return {
    systemPrompt: buildSystemPrompt(locale),
    tools:        TOOL_DECLARATIONS,
    model:        MODEL,
    executeTool:  (name, args) => executeTool(name, args, userId),
  };
}

// ─── Gemini agent loop ────────────────────────────────────────────────────────

async function runAgentLoop(userId, userText, dbHistory, signal, agent) {
  const contents = [
    ...dbHistory.map(m => ({
      role: m.role === 'model' || m.role === 'psychologist' ? 'model' : 'user',
      parts: [{ text: m.text }],
    })),
    { role: 'user', parts: [{ text: userText }] },
  ];

  const baseBody = {
    system_instruction: { parts: [{ text: agent.systemPrompt }] },
    tools: [{ function_declarations: agent.tools }],
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 2048,
      ...(agent.thinkingConfig ? { thinkingConfig: agent.thinkingConfig } : {}),
    },
  };

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${agent.model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  let totalInput = 0;
  let totalOutput = 0;
  let preamble = ''; // text sent alongside a tool call — the reply if the final turn has none

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

    // Text alongside a function call (e.g. save_strategy_feedback) is a
    // preamble — run the call and let the next turn write the reply.
    if (fnParts.length === 0 && (textPart?.text.trim() || preamble)) {
      return { text: textPart?.text.trim() ? textPart.text : preamble, usage: { inputTokens: totalInput, outputTokens: totalOutput } };
    }

    if (fnParts.length === 0) {
      throw new Error('Gemini returned no text and no function calls');
    }
    if (textPart?.text.trim()) preamble = textPart.text;

    // Append model's tool-call turn
    contents.push({ role: 'model', parts });

    const statuses = fnParts.map(p => ({
      type: 'status',
      text: TOOL_STATUS[p.functionCall.name] ?? 'Looking something up...',
    }));
    publish(userId, statuses);

    // Execute tools (in parallel) and append results
    const responseParts = await Promise.all(
      fnParts.map(async p => {
        const result = await agent.executeTool(p.functionCall.name, p.functionCall.args ?? {});
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
const toClaudeTools = (declarations) => declarations.map(t => ({
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

async function runClaudeAgentLoop(userId, userText, dbHistory, signal, agent) {
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
  let preamble    = ''; // text sent alongside a tool call — the reply if the final turn has none

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
          system:      agent.systemPrompt,
          tools:       toClaudeTools(agent.tools),
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
        text:  textBlock?.text?.trim() ? textBlock.text : preamble,
        usage: { inputTokens: totalInput, outputTokens: totalOutput },
      };
    }
    if (textBlock?.text?.trim()) preamble = textBlock.text;

    // Append assistant's tool-call turn, then execute tools in parallel
    messages.push({ role: 'assistant', content });

    const statuses = toolBlocks.map(b => ({
      type: 'status',
      text: TOOL_STATUS[b.name] ?? 'Looking something up...',
    }));
    publish(userId, statuses);

    const toolResults = await Promise.all(
      toolBlocks.map(async b => {
        const result = await agent.executeTool(b.name, b.input ?? {});
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
      select: { id: true, role: true, text: true, scripted: true, createdAt: true },
    });
    publish(req.userId, [msg]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/coach/scripted
 * Body: { messages: [{ role: 'user' | 'model', text: string }] }
 * Saves fixed (non-LLM) chat turns — the Learn module chat's opening round of
 * a strategy check-in ("Have you tried it?" → the parent's choice → a fixed
 * follow-up) — and publishes them like any chat message. They're part of the
 * history, so the coach picks up from them on the parent's next message.
 * Does NOT trigger the AI agent.
 */
const MAX_SCRIPTED_MESSAGES = 4;
router.post('/scripted', async (req, res, next) => {
  try {
    const { messages } = req.body;
    const valid = Array.isArray(messages)
      && messages.length > 0
      && messages.length <= MAX_SCRIPTED_MESSAGES
      && messages.every(m => ['user', 'model'].includes(m?.role) && typeof m.text === 'string' && m.text.trim() && m.text.length <= 2000);
    if (!valid) return res.status(400).json({ error: 'messages must be 1-4 { role: user|model, text }' });

    // Explicit, increasing timestamps keep the turns in order (history and
    // long-poll sort by createdAt).
    const base = Date.now();
    const saved = [];
    for (const [i, m] of messages.entries()) {
      saved.push(await prisma.coachChatMessage.create({
        data: { userId: req.userId, role: m.role, text: m.text.trim(), scripted: true, createdAt: new Date(base + i) },
        select: { id: true, role: true, text: true, scripted: true, createdAt: true },
      }));
    }
    publish(req.userId, saved);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── Bookmarks ────────────────────────────────────────────────────────────────

const BOOKMARK_SELECT = { id: true, messageId: true, moduleKey: true, text: true, messageCreatedAt: true, createdAt: true };

/**
 * GET /api/coach/bookmarks?moduleKey=<key>
 * The parent's bookmarked coach replies (from that module's chat, if given),
 * newest first: { bookmarks: [...] }.
 */
router.get('/bookmarks', async (req, res, next) => {
  try {
    const { moduleKey } = req.query;
    if (moduleKey != null && !LEARN_MODULE_KEYS.has(moduleKey)) return res.status(400).json({ error: 'Unknown module' });
    const bookmarks = await prisma.chatBookmark.findMany({
      where: { userId: req.userId, ...(moduleKey ? { moduleKey } : {}) },
      orderBy: { createdAt: 'desc' },
      select: BOOKMARK_SELECT,
    });
    res.json({ bookmarks });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/coach/bookmarks
 * Body: { messageId: string, moduleKey?: string }
 * Bookmarks one of the coach's replies (not the app's fixed lines).
 * Bookmarking the same message again returns the existing bookmark.
 */
router.post('/bookmarks', async (req, res, next) => {
  try {
    const { messageId, moduleKey } = req.body;
    if (typeof messageId !== 'string' || !messageId) return res.status(400).json({ error: 'messageId is required' });
    if (moduleKey != null && !LEARN_MODULE_KEYS.has(moduleKey)) return res.status(400).json({ error: 'Unknown module' });

    const message = await prisma.coachChatMessage.findFirst({
      where: { id: messageId, userId: req.userId },
      select: { role: true, text: true, scripted: true, createdAt: true },
    });
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.role !== 'model' || message.scripted) {
      return res.status(400).json({ error: 'Only coach replies can be bookmarked' });
    }

    const bookmark = await prisma.chatBookmark.upsert({
      where: { userId_messageId: { userId: req.userId, messageId } },
      update: {},
      create: {
        userId: req.userId,
        messageId,
        moduleKey: moduleKey ?? null,
        text: message.text,
        messageCreatedAt: message.createdAt,
      },
      select: BOOKMARK_SELECT,
    });
    res.json({ bookmark });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/coach/bookmarks/:id
 * Removes a bookmark, by bookmark id or by the bookmarked message's id.
 */
router.delete('/bookmarks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { count } = await prisma.chatBookmark.deleteMany({
      where: { userId: req.userId, OR: [{ id }, { messageId: id }] },
    });
    res.json({ deleted: count });
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
      select: { id: true, role: true, text: true, scripted: true, createdAt: true },
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
      select: { id: true, role: true, text: true, scripted: true, createdAt: true },
    });
    res.json({ messages });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/coach/chat
 * Body: { message: string, locale?: string, moduleKey?: string }
 * moduleKey (e.g. 'screenTime') = a Learn module's chat: same history, but the
 * module's scoped prompt and strategy-feedback tool (see buildAgent).
 * Returns: { reply: string }
 */
router.post('/chat', async (req, res, next) => {
  try {
    const { message, locale, moduleKey } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }
    const userText = message.trim();
    const userLocale = (typeof locale === 'string' && LOCALE_NAMES[locale]) ? locale : 'en';
    if (moduleKey != null && !LEARN_MODULE_KEYS.has(moduleKey)) {
      return res.status(400).json({ error: 'Unknown module' });
    }

    // Save & publish the user message immediately so admin sees it without waiting for LLM
    const userMsg = await prisma.coachChatMessage.create({
      data: { userId: req.userId, role: 'user', text: userText },
      select: { id: true, role: true, text: true, scripted: true, createdAt: true },
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

    const agent = await buildAgent(req.userId, userLocale, moduleKey);
    const label = moduleKey ? `coach-chat-${moduleKey}` : 'coach-chat';

    const abortController = new AbortController();
    agentBus.setActive(req.userId, abortController);

    const start = Date.now();
    let result;
    let usedRetry    = false;
    let usedFallback = false;
    let provider     = 'gemini';
    let model        = agent.model;

    const isUserAbort = () => abortController.signal.aborted;

    try {
      result = await runAgentLoop(req.userId, userText, dbHistory, abortController.signal, agent);
    } catch (firstErr) {
      if (firstErr.name === 'AbortError' && isUserAbort()) {
        agentBus.clear(req.userId);
        return res.status(200).json({ reply: null, aborted: true });
      }

      if (firstErr.name !== 'AbortError') {
        agentBus.clear(req.userId);
        logLLMCall({
          label, model, provider,
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
        label, model, provider,
        latencyMs: Date.now() - start,
        inputTokens: null, outputTokens: null,
        hasSchema: false, usedFallback: false, usedRepair: false, usedRetry: true,
        ok: false, error: firstErr.message,
      });

      try {
        result = await runAgentLoop(req.userId, userText, dbHistory, abortController.signal, agent);
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
          label, model: agent.model, provider: 'gemini',
          latencyMs: Date.now() - start,
          inputTokens: null, outputTokens: null,
          hasSchema: false, usedFallback: true, usedRepair: false, usedRetry: true,
          ok: false, error: retryErr.message,
        });

        try {
          result = await runClaudeAgentLoop(req.userId, userText, dbHistory, abortController.signal, agent);
        } catch (claudeErr) {
          agentBus.clear(req.userId);
          logLLMCall({
            label, model, provider,
            latencyMs: Date.now() - start,
            inputTokens: null, outputTokens: null,
            hasSchema: false, usedFallback: true, usedRepair: false, usedRetry: true,
            ok: false, error: claudeErr.message,
          });
          sendLLMFailureAlert({
            label, model, error: claudeErr.message,
            to: 'info@chromamind.ai',
          });
          const sorryText = "I'm having some trouble right now and couldn't process your message. Please try again in a moment, or tap \"Talk to a Psychologist\" if you need immediate support.";
          const sorryMsg = await prisma.coachChatMessage.create({
            data: { userId: req.userId, role: 'model', text: sorryText },
            select: { id: true, role: true, text: true, scripted: true, createdAt: true },
          });
          publish(req.userId, [sorryMsg]);
          return res.json({ reply: sorryText });
        }
      }
    }

    agentBus.clear(req.userId);

    logLLMCall({
      label, model, provider,
      latencyMs: Date.now() - start,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      hasSchema: false, usedFallback, usedRepair: false, usedRetry,
      ok: true, error: null,
    });

    // A special play time offer's marker is kept in the text (the app shows
    // the offer's options from it) and recorded.
    const { text: reply, offered } = moduleKey
      ? await prepareOfferReply(req.userId, result.text.trim())
      : { text: result.text.trim(), offered: false };

    const modelMsg = await prisma.coachChatMessage.create({
      data: { userId: req.userId, role: 'model', text: reply },
      select: { id: true, role: true, text: true, scripted: true, createdAt: true },
    });
    publish(req.userId, [modelMsg]);
    if (offered) await recordOffer(req.userId, moduleKey, modelMsg.id);

    res.json({ reply });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
