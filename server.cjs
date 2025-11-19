const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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
