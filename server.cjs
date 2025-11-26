const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration - allow any localhost port in development
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // In production, use FRONTEND_URL from env
    if (process.env.NODE_ENV === 'production') {
      const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
      if (origin === allowedOrigin) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // In development, allow any localhost port
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Body parser (increase limit for audio file uploads)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Configuration
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Email configuration
const emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const COACH_EMAIL = process.env.COACH_EMAIL;

// Retry helper with exponential backoff
const fetchWithRetry = async (url, options, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);

            // Retry on 5xx errors
            if (response.status >= 500 && attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
                console.log(`API error ${response.status}, retrying in ${delay/1000}s (attempt ${attempt}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            return response;
        } catch (error) {
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000;
                console.log(`Network error, retrying in ${delay/1000}s (attempt ${attempt}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
};

// Mount auth routes
const authRoutes = require('./server/routes/auth.cjs');
app.use('/api/auth', authRoutes);

// Mount session routes
const sessionRoutes = require('./server/routes/sessions.cjs');
app.use('/api/sessions', sessionRoutes);

// Mount learning progress routes
const learningRoutes = require('./server/routes/learning.cjs');
app.use('/api/learning', learningRoutes);

// Mount transcription proxy routes (PDPA compliant with anonymization)
const transcriptionProxyRoutes = require('./server/routes/transcription-proxy.cjs');
app.use('/api/transcription', transcriptionProxyRoutes);

// Mount PCIT analysis proxy routes (PDPA compliant with anonymization)
const pcitProxyRoutes = require('./server/routes/pcit-proxy.cjs');
app.use('/api/pcit', pcitProxyRoutes);

// Mount WACB-N survey routes
const wacbSurveyRoutes = require('./server/routes/wacb-survey.cjs');
app.use('/api/wacb-survey', wacbSurveyRoutes);

// DEPRECATED: Old PCIT endpoints (will be removed after frontend migration)
// TODO: Remove these after frontend is updated to use /api/pcit/* endpoints

// Competency Analysis endpoint
app.post('/api/competency-analysis', async (req, res) => {
    try {
        const { counts } = req.body;

        // Validate request body
        if (!counts || typeof counts !== 'object') {
            return res.status(400).json({ error: 'Missing or invalid counts object' });
        }

        const requiredFields = ['praise', 'reflect', 'describe', 'imitate', 'question', 'command', 'criticism', 'negative_phrases', 'neutral'];
        for (const field of requiredFields) {
            if (typeof counts[field] !== 'number') {
                return res.status(400).json({ error: `Missing or invalid count for: ${field}` });
            }
        }

        if (!ANTHROPIC_API_KEY) {
            return res.status(500).json({ error: 'Anthropic API key not configured' });
        }

        const totalDonts = counts.question + counts.command + counts.criticism + counts.negative_phrases;
        const totalDos = counts.praise + counts.reflect + counts.describe + counts.imitate;

        const prompt = `You are an expert PCIT (Parent-Child Interaction Therapy) Supervisor and Coder. Your task is to analyze raw PCIT tag counts from a session and provide a comprehensive competency analysis, including recommendations.

**1. Data Input (Raw Counts for a 5-minute session):**

- Labeled Praises: ${counts.praise}
- Reflections: ${counts.reflect}
- Behavioral Descriptions: ${counts.describe}
- Imitations: ${counts.imitate}
- Questions: ${counts.question}
- Commands: ${counts.command}
- Criticisms: ${counts.criticism}
- Negative Phrases: ${counts.negative_phrases}
- Neutral Talk: ${counts.neutral}
- Total DO Skills: ${totalDos}
- Total DON'T Skills: ${totalDonts}

**2. PCIT Competency Criteria (Target for 5 minutes):**

* **Labeled Praises (LP):** ≥ 10
* **Reflections (R):** ≥ 10
* **Behavioral Descriptions (BD):** ≥ 10
* **Total Don't Skills (Q+C+Crit):** ≤ 3
* **Negative Phrases (NP):** = 0

**3. Output Requirements:**

* **Performance Table:** Create a clear table comparing the **Actual Counts** against the **Target Goal** for Labeled Praise, Reflections, Descriptions, and Total Don't Skills, noting whether each goal was met.

* **Ratio Calculation:** Calculate and state the **"Do" to "Don't" Ratio** and the **Labeled Praise to Criticism Ratio**.

* **Analysis and Feedback:** Write a concise, professional analysis for the parent.
    * Identify which goals were met and which were missed.
    * Highlight the parent's **strongest skill** and the area where they demonstrated the **most difficulty**.
    * Provide **one specific, actionable recommendation** for practice to meet the unmet goals (e.g., *increase the frequency of X by Y*).
    * When there is negative phrase used, guide the parent back to PCIT skills (e.g., ignoring mild negative behavior, using attention to positive).`;

        const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 2048,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Anthropic API error:', response.status, errorText);
            throw new Error(`Anthropic API error: ${response.status}`);
        }

        const data = await response.json();
        const analysisText = data.content[0].text;

        res.json({ analysis: analysisText });

    } catch (error) {
        console.error('Competency analysis error:', error.message, error.stack);
        res.status(500).json({
            error: 'Failed to analyze competency',
            details: error.message
        });
    }
});

// Combined Speaker ID + PCIT Coding endpoint (reduces 2 API calls to 1)
app.post('/api/speaker-and-coding', async (req, res) => {
    try {
        const { transcript } = req.body;

        // Validate request body
        if (!transcript || !Array.isArray(transcript)) {
            return res.status(400).json({ error: 'Missing or invalid transcript array' });
        }

        if (transcript.length === 0) {
            return res.status(400).json({ error: 'Transcript is empty' });
        }

        // Validate each utterance
        for (let i = 0; i < transcript.length; i++) {
            const utterance = transcript[i];
            if (typeof utterance.speaker !== 'number') {
                return res.status(400).json({ error: `Invalid speaker at index ${i}` });
            }
            if (typeof utterance.text !== 'string' || !utterance.text.trim()) {
                return res.status(400).json({ error: `Invalid or empty text at index ${i}` });
            }
        }

        if (!ANTHROPIC_API_KEY) {
            return res.status(500).json({ error: 'Anthropic API key not configured' });
        }

        // Format transcript for the prompt
        const formattedScript = transcript
            .map(u => `Speaker ${u.speaker}: "${u.text}"`)
            .join('\n');

        const prompt = `You are an expert PCIT (Parent-Child Interaction Therapy) Supervisor and Coder. You will perform TWO tasks on the provided conversation script.

**TASK 1: SPEAKER IDENTIFICATION**

Analyze the conversation to determine which speaker is the Parent and which is the Child.

Guidelines for Identification:

Look for Parent "PRIDE" Skills:
- Behavioral Descriptions: Sentences starting with "You are..." describing the other person's actions (e.g., "You are stacking the blocks").
- Reflections: Repeating or paraphrasing what the other speaker just said (e.g., Spk A: "It crashed!" -> Spk B: "It crashed hard!").
- Labeled Praises: Specific praise for behaviors (e.g., "Good job staying calm," "I like how gently you are playing").
- Neutrality/Patience: Ignoring minor negative behaviors or following the other speaker's lead in play.

Look for Child Behaviors:
- Directives/Demands: "Give me that," "No," "Mine."
- Fantasy/Play Talk: Initiating scenarios (e.g., "The car is going to jail").
- Sound Effects: "Vroom," "Crash," etc.
- Simple/Fragmented Speech: Shorter, less structured sentences.

**TASK 2: PCIT CODING**

After identifying the Parent, code EVERY line spoken by the Parent with one of these tags:

Category Definitions:
* **[DO: Describe]:** Behavioral Description. The parent describes what the child is doing, holding, or seeing (e.g., "You are building a tall tower"). *Note: Describing the parent's own behavior does not count; it must be the child's behavior.*
* **[DO: Reflect]:** Reflection. The parent repeats or paraphrases what the child just said with the same meaning.
* **[DO: Praise]:** Labeled Praise. The parent praises a specific behavior or attribute (e.g., "Great job sitting still").
* **[DO: Imitate]:** Copying play. The parent explicitly states they are copying the child (e.g., "I'm going to draw a circle just like you"). *Note: In text-only scripts, this is rare; only use if the dialogue explicitly confirms imitation.*
* **[DON'T: Question]:** Asking for info. Any sentence that requires an answer or ends in a rising inflection, including "tag" questions (e.g., "It's blue, right?").
* **[DON'T: Command]:** Telling the child what to do. Includes direct orders ("Sit down") and indirect suggestions ("Let's play with the blocks").
* **[DON'T: Criticism]:** Negative correction. Words like "No," "Don't," "Stop," or pointing out a mistake.
* **[DON'T: Negative Phrases]:** Intense frustration, anger, despair, or verbally abusive/aggressive/shaming language. Includes high sentiment negativity, words like "hate," "terrible," "stop it now," "stupid," "bad kid," or "I hate you."
* **[Neutral]:** "Natural" conversation fillers, information giving, or self-descriptions that do not fit the PRIDE skills or Avoid skills (e.g., "Oh, okay," "I see," "It is time to go.").

**Input Script:**
${formattedScript}

**Output Format:**

=== SPEAKER IDENTIFICATION ===
Parent: Speaker [X]
Child: Speaker [Y]
Confidence: [0-100]%
Key Evidence:
1. [First specific example]
2. [Second specific example]
3. [Third specific example]

=== PCIT CODING ===
**Parent:** "Dialogue" -> **[TAG]**
[Continue for all parent utterances]`;

        const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 3072,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Anthropic API error:', response.status, errorText);
            throw new Error(`Anthropic API error: ${response.status}`);
        }

        const data = await response.json();

        // Validate response structure
        if (!data.content || !data.content[0] || !data.content[0].text) {
            console.error('Unexpected API response structure:', JSON.stringify(data).substring(0, 200));
            throw new Error('Invalid response format from Anthropic API');
        }

        const resultText = data.content[0].text;

        // Parse the response to extract speaker identification and coding
        const speakerMatch = resultText.match(/Parent:\s*Speaker\s*(\d+)/i);
        const parentSpeaker = speakerMatch ? parseInt(speakerMatch[1], 10) : null;

        // Extract coding section with multiple fallback patterns
        let coding = null;
        const codingPatterns = [
            /=== PCIT CODING ===\s*([\s\S]*)/i,
            /PCIT CODING[:\s]*([\s\S]*)/i,
            /\*\*Parent:\*\*\s*".*?"\s*->\s*\*\*\[.*?\]\*\*([\s\S]*)/i
        ];

        for (const pattern of codingPatterns) {
            const match = resultText.match(pattern);
            if (match) {
                coding = match[1].trim();
                break;
            }
        }

        // Fallback to full response if no pattern matched
        if (!coding) {
            console.warn('Could not parse PCIT coding section, using full response');
            coding = resultText;
        }

        // Warn if parent speaker couldn't be identified
        if (parentSpeaker === null) {
            console.warn('Could not identify parent speaker from response');
        }

        res.json({
            parentSpeaker,
            coding,
            fullResponse: resultText
        });

    } catch (error) {
        console.error('Speaker and coding error:', error.message, error.stack);
        res.status(500).json({
            error: 'Failed to analyze and code transcript',
            details: error.message
        });
    }
});

// PDI (Parent-Directed Interaction) Speaker ID + Coding endpoint
app.post('/api/pdi-speaker-and-coding', async (req, res) => {
    try {
        const { transcript } = req.body;

        // Validate request body
        if (!transcript || !Array.isArray(transcript)) {
            return res.status(400).json({ error: 'Missing or invalid transcript array' });
        }

        if (transcript.length === 0) {
            return res.status(400).json({ error: 'Transcript is empty' });
        }

        // Validate each utterance
        for (let i = 0; i < transcript.length; i++) {
            const utterance = transcript[i];
            if (typeof utterance.speaker !== 'number') {
                return res.status(400).json({ error: `Invalid speaker at index ${i}` });
            }
            if (typeof utterance.text !== 'string' || !utterance.text.trim()) {
                return res.status(400).json({ error: `Invalid or empty text at index ${i}` });
            }
        }

        if (!ANTHROPIC_API_KEY) {
            return res.status(500).json({ error: 'Anthropic API key not configured' });
        }

        // Format transcript for the prompt
        const formattedScript = transcript
            .map(u => `Speaker ${u.speaker}: "${u.text}"`)
            .join('\n');

        const prompt = `You are an expert PCIT (Parent-Child Interaction Therapy) Supervisor and Coder specializing in PDI (Parent-Directed Interaction). You will perform TWO tasks on the provided conversation script.

**TASK 1: SPEAKER IDENTIFICATION**

Analyze the conversation to determine which speaker is the Parent and which is the Child.

Guidelines for Identification:

Look for Parent behaviors in PDI:
- Giving commands or instructions to the child
- Using warning phrases about time-out
- Giving praise after child compliance
- Calm, firm tone when giving directions

Look for Child behaviors:
- Responding to commands (complying or not)
- Asking questions
- Making requests
- Expressing emotions or protests

**TASK 2: PDI CODING**

After identifying the Parent, code EVERY line spoken by the Parent with one of these tags:

**Effective Command Skills (DO):**
* **[DO: Direct Command]:** A clear, direct statement telling the child what to do. Not a question or suggestion. (e.g., "Please hand me the block", "Put your shoes on")
* **[DO: Positive Command]:** States what the child should DO, not what they should NOT do. (e.g., "Walk please" instead of "Don't run")
* **[DO: Specific Command]:** Clear and precise instruction the child can understand. (e.g., "Put your shoes in the box by the door")
* **[DO: Labeled Praise]:** Immediate, specific praise after child complies. (e.g., "Thank you for listening right away!", "Great job putting that away!")
* **[DO: Correct Warning]:** Uses the exact PDI warning phrase: "If you don't [command], you will have to sit on the time-out chair."
* **[DO: Correct Time-Out Statement]:** Uses exact phrase when starting time-out: "You didn't do what I told you to do, so you have to sit on the time-out chair."

**Ineffective Command Skills (DON'T):**
* **[DON'T: Indirect Command]:** Phrased as a question or suggestion rather than direct command. (e.g., "Will you hand me the block?", "Can you put that away?", "Let's clean up")
* **[DON'T: Negative Command]:** Tells child what NOT to do. (e.g., "Don't run", "Stop hitting", "No yelling")
* **[DON'T: Vague Command]:** Unclear or imprecise instruction. (e.g., "Be good", "Behave", "Act nice", "Settle down")
* **[DON'T: Chained Command]:** Multiple commands given at once. (e.g., "Pick up your toys and put on your shoes and come here")
* **[DON'T: Harsh Tone]:** Yelling, threatening, or aggressive language. (e.g., "I SAID SIT DOWN NOW!", "Do it or else!")

* **[Neutral]:** Conversation that is not a command, praise, or warning. (e.g., "Okay", "I see", "The timer went off")

**Input Script:**
${formattedScript}

**Output Format:**

=== SPEAKER IDENTIFICATION ===
Parent: Speaker [X]
Child: Speaker [Y]
Confidence: [0-100]%
Key Evidence:
1. [First specific example]
2. [Second specific example]
3. [Third specific example]

=== PDI CODING ===
**Parent:** "Dialogue" -> **[TAG]**
[Continue for all parent utterances]`;

        const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 3072,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Anthropic API error:', response.status, errorText);
            throw new Error(`Anthropic API error: ${response.status}`);
        }

        const data = await response.json();

        // Validate response structure
        if (!data.content || !data.content[0] || !data.content[0].text) {
            console.error('Unexpected API response structure:', JSON.stringify(data).substring(0, 200));
            throw new Error('Invalid response format from Anthropic API');
        }

        const resultText = data.content[0].text;

        // Parse the response to extract speaker identification and coding
        const speakerMatch = resultText.match(/Parent:\s*Speaker\s*(\d+)/i);
        const parentSpeaker = speakerMatch ? parseInt(speakerMatch[1], 10) : null;

        // Extract coding section with multiple fallback patterns
        let coding = null;
        const codingPatterns = [
            /=== PDI CODING ===\s*([\s\S]*)/i,
            /PDI CODING[:\s]*([\s\S]*)/i,
            /\*\*Parent:\*\*\s*".*?"\s*->\s*\*\*\[.*?\]\*\*([\s\S]*)/i
        ];

        for (const pattern of codingPatterns) {
            const match = resultText.match(pattern);
            if (match) {
                coding = match[1].trim();
                break;
            }
        }

        // Fallback to full response if no pattern matched
        if (!coding) {
            console.warn('Could not parse PDI coding section, using full response');
            coding = resultText;
        }

        // Warn if parent speaker couldn't be identified
        if (parentSpeaker === null) {
            console.warn('Could not identify parent speaker from response');
        }

        res.json({
            parentSpeaker,
            coding,
            fullResponse: resultText
        });

    } catch (error) {
        console.error('PDI speaker and coding error:', error.message, error.stack);
        res.status(500).json({
            error: 'Failed to analyze and code PDI transcript',
            details: error.message
        });
    }
});

// PDI Competency Analysis endpoint
app.post('/api/pdi-competency-analysis', async (req, res) => {
    try {
        const { counts } = req.body;

        // Validate request body
        if (!counts || typeof counts !== 'object') {
            return res.status(400).json({ error: 'Missing or invalid counts object' });
        }

        const requiredFields = ['direct_command', 'positive_command', 'specific_command', 'labeled_praise', 'correct_warning', 'correct_timeout', 'indirect_command', 'negative_command', 'vague_command', 'chained_command', 'harsh_tone', 'neutral'];
        for (const field of requiredFields) {
            if (typeof counts[field] !== 'number') {
                return res.status(400).json({ error: `Missing or invalid count for: ${field}` });
            }
        }

        if (!ANTHROPIC_API_KEY) {
            return res.status(500).json({ error: 'Anthropic API key not configured' });
        }

        const totalEffective = counts.direct_command + counts.positive_command + counts.specific_command;
        const totalIneffective = counts.indirect_command + counts.negative_command + counts.vague_command + counts.chained_command;
        const totalCommands = totalEffective + totalIneffective;
        const effectivePercent = totalCommands > 0 ? Math.round((totalEffective / totalCommands) * 100) : 0;

        const prompt = `You are an expert PCIT (Parent-Child Interaction Therapy) Supervisor and Coder. Your task is to analyze raw PDI (Parent-Directed Interaction) tag counts from a session and provide a comprehensive competency analysis, including recommendations.

**1. Data Input (Raw Counts for PDI session):**

**Effective Command Skills:**
- Direct Commands: ${counts.direct_command}
- Positive Commands: ${counts.positive_command}
- Specific Commands: ${counts.specific_command}
- Labeled Praises (after compliance): ${counts.labeled_praise}
- Correct Warnings: ${counts.correct_warning}
- Correct Time-Out Statements: ${counts.correct_timeout}

**Ineffective Command Skills:**
- Indirect Commands (questions): ${counts.indirect_command}
- Negative Commands (don't/stop): ${counts.negative_command}
- Vague Commands: ${counts.vague_command}
- Chained Commands: ${counts.chained_command}
- Harsh Tone: ${counts.harsh_tone}

- Neutral Talk: ${counts.neutral}

**Calculated Metrics:**
- Total Commands: ${totalCommands}
- Effective Commands: ${totalEffective} (${effectivePercent}%)
- Ineffective Commands: ${totalIneffective}

**2. PDI Competency Criteria:**

* **Effective Commands:** ≥ 75% of all commands should be effective (direct, positive, specific)
* **Labeled Praise after Compliance:** Should praise compliance consistently
* **Correct Warning Sequence:** Must use exact PDI warning wording when needed
* **Harsh Tone:** = 0 (never acceptable)

**3. Output Requirements:**

* **Performance Table:** Create a clear table comparing the **Actual Counts** against the **Target Goals** for effective command percentage, labeled praises, and ineffective commands.

* **Command Quality Analysis:** Evaluate the ratio of effective to ineffective commands and identify patterns.

* **Analysis and Feedback:** Write a concise, professional analysis for the parent.
    * Identify which goals were met and which were missed.
    * Highlight the parent's **strongest skill** (e.g., direct commands, positive phrasing) and the area needing **most improvement**.
    * Provide **one specific, actionable recommendation** for practice (e.g., "Convert question commands like 'Can you...?' to direct statements like 'Please...'").
    * If harsh tone was used, address this as a priority concern.
    * Praise progress in giving clear, calm commands.`;

        const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 2048,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Anthropic API error:', response.status, errorText);
            throw new Error(`Anthropic API error: ${response.status}`);
        }

        const data = await response.json();
        const analysisText = data.content[0].text;

        res.json({ analysis: analysisText });

    } catch (error) {
        console.error('PDI competency analysis error:', error.message, error.stack);
        res.status(500).json({
            error: 'Failed to analyze PDI competency',
            details: error.message
        });
    }
});

// Send flagged items to coach via email
app.post('/api/send-coach-alert', async (req, res) => {
    try {
        const { flaggedItems, sessionInfo } = req.body;

        // Validate request
        if (!flaggedItems || !Array.isArray(flaggedItems) || flaggedItems.length === 0) {
            return res.status(400).json({ error: 'No flagged items provided' });
        }

        if (!COACH_EMAIL) {
            return res.status(500).json({ error: 'Coach email not configured' });
        }

        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            return res.status(500).json({ error: 'Email service not configured' });
        }

        // Format timestamp helper
        const formatTimestamp = (seconds) => {
            if (seconds === null || seconds === undefined) return '--:--';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        // Build email content
        const flaggedItemsHtml = flaggedItems.map((item, index) => `
            <div style="background: #fff; border: 1px solid #fca5a5; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="background: #fee2e2; color: #dc2626; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                        Timestamp: ${formatTimestamp(item.timestamp)}
                    </span>
                    ${item.speaker !== null ? `<span style="color: #6b7280; font-size: 12px;">Speaker ${item.speaker}</span>` : ''}
                </div>
                <p style="color: #1f2937; font-weight: 500; margin: 0 0 8px 0;">"${item.text}"</p>
                <p style="color: #dc2626; font-size: 12px; font-style: italic; margin: 0;">${item.reason}</p>
            </div>
        `).join('');

        const emailHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 20px;">⚠️ PCIT Session Alert</h1>
                    <p style="margin: 8px 0 0 0; opacity: 0.9;">Negative phrases detected - immediate review required</p>
                </div>
                <div style="background: #fef2f2; padding: 20px; border: 1px solid #fca5a5; border-top: none; border-radius: 0 0 8px 8px;">
                    ${sessionInfo ? `
                        <div style="background: white; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                            <p style="margin: 0; color: #6b7280; font-size: 14px;">
                                <strong>Session Date:</strong> ${sessionInfo.date || new Date().toLocaleDateString()}<br/>
                                ${sessionInfo.parentName ? `<strong>Parent:</strong> ${sessionInfo.parentName}<br/>` : ''}
                                ${sessionInfo.childName ? `<strong>Child:</strong> ${sessionInfo.childName}` : ''}
                            </p>
                        </div>
                    ` : ''}
                    <h2 style="color: #dc2626; font-size: 16px; margin: 0 0 12px 0;">Flagged Utterances (${flaggedItems.length})</h2>
                    ${flaggedItemsHtml}
                    <p style="color: #6b7280; font-size: 12px; margin: 16px 0 0 0; text-align: center;">
                        This is an automated alert from the PCIT Coaching App
                    </p>
                </div>
            </div>
        `;

        // Send email
        await emailTransporter.sendMail({
            from: process.env.SMTP_USER,
            to: COACH_EMAIL,
            subject: `⚠️ PCIT Alert: ${flaggedItems.length} Negative Phrase(s) Detected`,
            html: emailHtml
        });

        console.log(`Coach alert email sent to ${COACH_EMAIL} with ${flaggedItems.length} flagged items`);
        res.json({ success: true, message: 'Alert sent to coach' });

    } catch (error) {
        console.error('Send coach alert error:', error.message, error.stack);
        res.status(500).json({
            error: 'Failed to send coach alert',
            details: error.message
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        services: {
            anthropic: !!ANTHROPIC_API_KEY,
            email: !!(process.env.SMTP_USER && COACH_EMAIL)
        }
    });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
});
