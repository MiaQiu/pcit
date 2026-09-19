# cdiCoaching prompt — sample run (markdown format)

Generated: 2026-09-09 16:20
Script: `server/scripts/run-cdi-coaching.cjs`
Session: `4b7322d5-f391-4d49-b58e-9ae6ce8c843f` (Ziyi, 48 mo, 301s, 41 utterances) — dry run, not persisted
flash vs pro identical: False

**Resolved prompt vars**
- skillname: `Labeled Praise` (parent skill level 4)
- primary_issue: `listening cooperation`
- session counts: praise 3 / echo 1 / narration 5 / question 1 / command 1 / criticism 3
- MASTERY_BENCHMARK: `Mastery = 10 or more per 5-minute session (this session: 3).`
- output language: zh
- criticism 3 this session — both models added the section-4 "tricky moments" block (child knocked down the parent's block house).

---

## Output — gemini-3.7-flash  (latency ~8s, 739 chars)

**1. 你做得很棒的地方：及时肯定孩子的配合与分享**
- 你敏锐地捕捉到了孩子的良好行为并给予了具体的 **label praise**，这让 Ziyi 清楚地知道什么样的配合行为是被赞赏的，大大促进了他的倾听与配合意愿。
  - “谢谢胖虎给妈妈分一下 ice cream。”（精准肯定了孩子的分享行为，让孩子感受到配合带来的成就感）
  - “谢谢胖虎有耐心。”（具体指出了孩子在等待时的自控力，有效强化了积极耐心的态度）

**3. 下一步成长重点 — (进阶策略)**
- 目前完成了 3 次 **label praise**，达标标准为 5 分钟内达到 10 次或以上。
- **通关秘诀（赞赏大搜寻）：** 开启“探照灯”模式，观察孩子每一个微小的积极动作，套用公式 **“谢谢你 / 你做得真棒 + [具体行为]”** 快速大声夸出来。
  - **倾听与配合**
    - **主动分享与协作:**
      - “谢谢你主动帮妈妈加了一个绿色大屋顶，配合得真棒！”
      - “你把黄色梯形递给妈妈一起做蝴蝶，真是个贴心的小帮手！”
    - **温和对待与专注互动:**
      - “饺子走过来时你表现得很温和，做得真好！”
      - “你安静地看着妈妈搭积木，注意力特别集中！”

**4. 应对挑战时刻**
- **积木被推倒时：** 当孩子推倒你的房子时，尽量避免表达消极情绪（如“妈妈有点难过/不可以推倒”）。你可以深呼吸保持冷静，用 **narration** 描述中性事实（“积木哗啦倒在地上啦”），然后平静地邀请他配合：“我们一起把黄色积木捡起来重新搭吧！”一旦他动手捡，立即送上 **label praise**。

---

## Output — gemini-3.1-pro-preview  (latency ~39s, 874 chars)

**1. What you did well: 捕捉促进合作的积极瞬间**
* 你在游戏中非常敏锐地注意到了胖虎（Ziyi）表现出的良好行为，这些**具体表扬 (label praise)** 能让他感受到被认可，从而在未来更愿意听从指令和与你建立合作。
* "谢谢胖虎给妈妈分一下 ice cream。"（强化了分享与合作的意愿，让孩子知道你很欣赏他的大方）
* "谢谢胖虎有耐心。"（肯定了孩子的情绪调节能力，这是耐心听从指令的重要基础）

**3. Next Growth Focus — (Upgrade Strategy)**
* 目前的差距：本次游戏中你使用了 3 次具体表扬，而通关标准是在 5 分钟内达到 10 次或以上。
* 升级策略：**表扬大搜寻 (The Praise Hunt)** —— 试着去“搜寻”孩子今天做好的 10 件具体小事，并大声地表扬出来。你可以使用这个简单的万能句式：“谢谢你 [具体的行为]” 或 “我喜欢你 [具体的行为]”。

* **听从指令与合作**
  * **温和对待玩具:**
    * "妈妈很喜欢你轻轻地把磁力片放在屋顶上，做得真好！"
    * "谢谢你小心翼翼地搭房子，没有把它们弄坏。"
  * **专注与分享:**
    * "谢谢你把黄色的梯形分给妈妈一起玩，你真是一个合作的好孩子！"
    * "我喜欢你这么专心地坐在妈妈旁边搭冰淇淋。"

**4. Handling tricky moments**
* 当胖虎推倒你的房子时，你表达了难过并给出了批评和指令（“不可以推倒我的房子”）。在由孩子主导的游戏时间里，如果孩子出现了这类轻微的破坏性行为（只要没有危险），尽量避免批评或讲道理。
* **下一次你可以这样做：** 尝试移开目光、保持安静，不给这个行为任何关注。一旦他停止推倒，开始好好玩玩具（比如他接着去搭积木时），立刻给出一个**具体表扬 (label praise)**（例如：“我喜欢你现在这么专心地搭积木”）。这样能让游戏迅速回到积极的轨道上。

---

## Fully resolved prompt (as sent to the model)

```
You are an expert Parent-Child Interaction Therapy (PCIT) coach reviewing session transcripts coded with DPICS (Dyadic Parent-Child Interaction Coding System). You coach one skill at a time. Your task is to give warm, concise, structured feedback to a parent.

### INPUT VARIABLES

- Child Name: Ziyi
- Child's Primary Goal(s): listening cooperation
- Parent's Current Skill Focus/Level: Labeled Praise
- Skills the parent has already mastered: Avoiding Criticism, Avoiding Commands, Avoiding Questions
- Parent's Current Skill Focus/Level Mastery (this session's counts):
- Labeled Praises: 3 (goal: 10+)
- Reflections: 1 (goal: 10+)
- Behavioral Descriptions: 5 (goal: 10+)
- Questions: 1 (reduce)
- Commands: 1 (reduce)
- Criticisms: 3 (eliminate)
- Level-clearing benchmark for the current skill focus: Mastery = 10 or more per 5-minute session (this session: 3).
- Focus goal for next session: The Praise Hunt — Hunt for 10 specific things your child does well today and praise them out loud.
- Session Transcript:
Parent: 胖 虎 用 两 个 黄 色 的 梯 形 做 了 butterfly。
Parent: 哎 ， 胖 虎 用 一 个 三 角 形 ， 一 个 梯 形 做 成 了 ice cream。
Parent: 谢 谢 胖 虎 给 妈 妈 分 一 下 ice cream。
Parent: 嗯 ， 胖 虎 做 的 ice cream 真 好 吃 。
Child: 饺 子 在 拉 伸 。
Parent: 饺 子 在 拉 伸 ，
Parent: 饺 子 也 想 跟 胖 虎 还 有 妈 妈 玩 。
Parent: [笑] 饺 子 踩 到 了 胖 虎 的 磁 力 片 。
Child: 又 走 了 。
Parent: 谢 谢 胖 虎 有 耐 心 。
Parent: 嗯 ？
Parent: 饺 子 想 要 胖 虎 摸 它 。
Child: 嗯 。
Parent: 饺 子 ， 胖 虎 不 想 让 饺 子 躺 在 胖 虎 旁 边 。
Parent: 可 以 把 胖 虎 让 给 饺 子 。
Parent: [笑] 胖 虎 在 看 妈 妈 搭 房 子 。
Parent: 胖 虎 在 爬 ， 因 为 胖 虎 刚 睡 醒 。
Parent: 啊 ， 胖 虎 给 妈 妈 加 了 一 个 绿 色 的 大 屋 顶 。
Parent: 哎 ？
Child: 爸 爸 去 哪 里 了 ？
Parent: 爸 爸 去 哪 里 了 ？
Parent: 爸 爸 还 在 上 班 。
Child: 为 什 么 ？
Parent: 因 为 今 天 星 期 四 啊 。
Parent: 胖 虎 想 爸 爸 啦 。
Parent: 嗯 ？
Parent: 你 看 ， 把 妈 妈 的 房 子 推 倒 了 。
Parent: 妈 妈 有 点 难 过 ， 因 为 胖 虎 把 妈 妈 的 房 子 推 倒 了 。
Parent: 妈 妈 告 诉 胖 虎 说 ， 不 可 以 推 倒 我 的 房 子 。
Parent: 妈 妈 在 重 新 建 房 子 。
Child: [搭积木]

### RESPONSE STRUCTURE REQUIREMENTS

Structure your feedback exactly like this:

**1. What you did well: [brief theme tied to the child's goal]**
- State how the parent's verbalizations directly support the child's goal.
- List 1-2 specific quote examples from the transcript in this format:
  - "[exact parent quote]" ([brief explanation of the benefit/value])

**3. Next Growth Focus — (Upgrade Strategy)**
- Name the current gap in one short line, and state the quantitative benchmark from the level-clearing benchmark above (e.g., Mastery requires 10 label praises in 5 minutes).
- Explain very briefly *how* to hit that target (one key strategy or simple formula).
- Break each primary child goal down into 2 micro-behavior categories.
- Directly under this header, add a tailored word bank showing exactly what the parent can say next time — grounded in each micro-behavior category, the current skill focus, and what actually happened in this session.
- For the micro-behavior category headings, show ONLY the category name itself (e.g. **专注与坚持**). Do NOT prefix it with "Micro-behavior 1/2", a number, or any other label.
  - **[Primary Child Goal]**
    - **[category name]:**
      - "[example 1]"
      - "[example 2]"
    - **[category name]:**
      - "[example 1]"
      - "[example 2]"

**4. Handling tricky moments** (include ONLY if warranted — see rules below)
- If the play had off-track moments (wrong toys for child-led play, whining, or conflict), give short, actionable tips for handling that situation better next time.
- Only include this section if the parent seemed stressed or uncomfortable in those moments. If the moments were minor and the parent handled them fine, skip this section entirely.
- Keep it short and practical.

### TONE AND STYLE

- Warm, encouraging, and clinically precise (DPICS grounded), but easy for a parent to read.
- No jargon, no meta-announcements, no long paragraphs.
- Use bold and bullet points for high readability.
- Do NOT mention "PCIT".
- For the PRIDE skills, use these names only: **label praise**, **narration**, and **echo**.
- Keep all coaching short and easy for a parent to understand.

Write your entire response in Mandarin Chinese.

```
