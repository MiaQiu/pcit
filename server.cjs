const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Configuration
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Claude API proxy endpoint
app.post('/api/analyze', async (req, res) => {
    try {
        const { transcript } = req.body;

        if (!ANTHROPIC_API_KEY) {
            return res.status(500).json({ error: 'Anthropic API key not configured' });
        }

        // Format transcript for the prompt
        const formattedScript = transcript
            .map(u => `Speaker ${u.speaker}: "${u.text}"`)
            .join('\n');

        const prompt = `Role: You are an expert PCIT (Parent-Child Interaction Therapy) coder and supervisor.

Task: Analyze the provided conversation script between two speakers. Determine which speaker is the Parent and which is the Child.

Guidelines for Identification:

Look for Parent "PRIDE" Skills:

Behavioral Descriptions: Sentences starting with "You are..." describing the other person's actions (e.g., "You are stacking the blocks").

Reflections: Repeating or paraphrasing what the other speaker just said (e.g., Spk A: "It crashed!" -> Spk B: "It crashed hard!").

Labeled Praises: Specific praise for behaviors (e.g., "Good job staying calm," "I like how gently you are playing").

Neutrality/Patience: Ignoring minor negative behaviors or following the other speaker's lead in play.

Look for Child Behaviors:

Directives/Demands: "Give me that," "No," "Mine."

Fantasy/Play Talk: Initiating scenarios (e.g., "The car is going to jail").

Sound Effects: "Vroom," "Crash," etc.

Simple/Fragmented Speech: Shorter, less structured sentences.

Input Script:
${formattedScript}

Output Format:

Identify the Parent: (e.g., "Speaker [X] is the Parent")

Confidence Score: (0-100%)

Key Evidence: List 3 specific examples from the text (e.g., specific reflections or descriptions) that confirm this classification.`;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1024,
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
        console.error('Analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze transcript' });
    }
});

// PCIT Coding endpoint
app.post('/api/pcit-coding', async (req, res) => {
    try {
        const { transcript } = req.body;

        if (!ANTHROPIC_API_KEY) {
            return res.status(500).json({ error: 'Anthropic API key not configured' });
        }

        // Format transcript with Parent/Child labels
        const formattedScript = transcript
            .map(u => `${u.role}: "${u.text}"`)
            .join('\n');

        const prompt = `You are an expert PCIT (Parent-Child Interaction Therapy) Supervisor and Coder. Your task is to analyze a transcript of a parent-child play session and code the Parent's verbalizations according to standard PCIT protocols.

**Instructions:**

1. Read the dialogue below.

2. Analyze each line spoken by the parent.

3. Assign one of the following tags to every single line spoken by parent based on the definitions below.

4. Do not label the child's lines, but use them as context to determine if the parent is Reflecting or Answering.

**Category Definitions:**

* **[DO: Describe]:** Behavioral Description. The parent describes what the child is doing, holding, or seeing (e.g., "You are building a tall tower"). *Note: Describing the parent's own behavior does not count; it must be the child's behavior.*

* **[DO: Reflect]:** Reflection. The parent repeats or paraphrases what the child just said with the same meaning.

* **[DO: Praise]:** Labeled Praise. The parent praises a specific behavior or attribute (e.g., "Great job sitting still").

* **[DO: Imitate]:** Copying play. The parent explicitly states they are copying the child (e.g., "I'm going to draw a circle just like you"). *Note: In text-only scripts, this is rare; only use if the dialogue explicitly confirms imitation.*

* **[DON'T: Question]:** Asking for info. Any sentence that requires an answer or ends in a rising inflection, including "tag" questions (e.g., "It's blue, right?").

* **[DON'T: Command]:** Telling the child what to do. Includes direct orders ("Sit down") and indirect suggestions ("Let's play with the blocks").

* **[DON'T: Criticism]:** Negative correction. Words like "No," "Don't," "Stop," or pointing out a mistake.

* **[Neutral]:** "Natural" conversation fillers, information giving, or self-descriptions that do not fit the PRIDE skills or Avoid skills (e.g., "Oh, okay," "I see," "It is time to go.").

**Output Format:**

Please present the output as a list in this format:

**Parent:** "Dialogue" -> **[TAG]**

**Input Script:**
${formattedScript}`;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
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
        const codingText = data.content[0].text;

        res.json({ coding: codingText });

    } catch (error) {
        console.error('PCIT coding error:', error);
        res.status(500).json({ error: 'Failed to code transcript' });
    }
});

// Competency Analysis endpoint
app.post('/api/competency-analysis', async (req, res) => {
    try {
        const { counts } = req.body;

        if (!ANTHROPIC_API_KEY) {
            return res.status(500).json({ error: 'Anthropic API key not configured' });
        }

        const totalDonts = counts.question + counts.command + counts.criticism;
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
- Neutral Talk: ${counts.neutral}
- Total DO Skills: ${totalDos}
- Total DON'T Skills: ${totalDonts}

**2. PCIT Competency Criteria (Target for 5 minutes):**

* **Labeled Praises (LP):** ≥ 10
* **Reflections (R):** ≥ 10
* **Behavioral Descriptions (BD):** ≥ 10
* **Total Don't Skills (Q+C+Crit):** ≤ 3

**3. Output Requirements:**

* **Performance Table:** Create a clear table comparing the **Actual Counts** against the **Target Goal** for Labeled Praise, Reflections, Descriptions, and Total Don't Skills, noting whether each goal was met.

* **Ratio Calculation:** Calculate and state the **"Do" to "Don't" Ratio** and the **Labeled Praise to Criticism Ratio**.

* **Analysis and Feedback:** Write a concise, professional analysis for the parent.
    * Identify which goals were met and which were missed.
    * Highlight the parent's **strongest skill** and the area where they demonstrated the **most difficulty**.
    * Provide **one specific, actionable recommendation** for practice to meet the unmet goals (e.g., *increase the frequency of X by Y*).`;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
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
        console.error('Competency analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze competency' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        services: {
            anthropic: !!ANTHROPIC_API_KEY
        }
    });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
});
