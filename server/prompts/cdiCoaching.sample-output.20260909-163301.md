# cdiCoaching prompt — sample run (context cache + CDI manual PDF)

Generated: 2026-09-09 16:33
Script: `server/scripts/run-cdi-coaching.cjs`
Session: `667ae6fc-702c-46f1-93d6-f1ea2f6e883e` (Ziyi, 48 mo, 301s, 63 utterances) — dry run, not persisted

**Change:** CDI coaching now uses a Gemini context cache, same pattern as DPICS coding.
- Cached: the static `cdiCoaching.txt` instructions (2924 chars) + `server/prompts/Parent-Child Interaction Therapy_CDI.pdf` (8 pages).
- Per-call prompt: only the per-session data (child, skill level, DPICS counts, benchmark, transcript) — 2482 chars.
- Cache key is model-qualified (`cdi-coaching-<model>`) because Gemini requires the CachedContent model and the generateContent model to match.
- Cold run uploads the PDF + creates the cache; warm runs log `Reusing ... cache` and skip both. TTL 600s (gateway default). Falls back to inline prompt (minus PDF) if the cache API errors.

**Resolved prompt vars**
- skillname: `Labeled Praise` (parent skill level 4)
- primary_issue: `listening cooperation`
- session counts: praise 6 / echo 1 / narration 5 / question 3 / command 2 / criticism 0
- MASTERY_BENCHMARK: `Mastery = 10 or more per 5-minute session (this session: 6).`
- output language: zh

---

## Output — gemini-3.7-flash  (612 chars)

**1. 你做得非常棒的地方：通过肯定积极行为促进配合意愿**
- 你在游戏中敏锐地捕捉到了孩子专注和坚持的瞬间，并通过温暖的 **label praise** 及时给予认可，这能有效建立孩子的安全感与自信心，让孩子更愿意在互动中倾听你的声音并主动配合。
- “妈妈喜欢看胖虎专心地在摆房子。”（明确指出了“专心摆房子”的具体行为，让孩子清楚知道什么样的行为是值得鼓励的，极大增强了专注力。）
- “哎，妈妈喜欢看胖虎认真地把它修好了。”（精准赞美了孩子在遇到困难时“认真修好”的坚持与耐心，有效激发了孩子主动配合与解决问题的动力。）

**3. 下一步进阶重点（通关策略）**
- 当前与目标还差 4 次，通关标准为 5 分钟内使用 10 次 **label praise**（本次为 6 次）。
- **通关秘诀**：化身“赞美侦探”，使用公式 **“我喜欢你/谢谢你 + [正在做的具体动作]”**，一旦看到孩子有微小的正面动作，立刻大声明确地夸出来。
  - **倾听与配合**
    - **面对挑战时的坚持与探索**
      - “我喜欢你在积木没对齐时，愿意耐心地再试一次。”
      - “你真棒，自己动脑筋想办法把中间的小门修好了。”
    - **互动中的分享与主动表达**
      - “谢谢你把小动物拿出来和妈妈一起玩。”
      - “我喜欢你用温和的声音告诉妈妈发生了什么。”

---

## Output — gemini-3.1-pro-preview  (596 chars)

**1. What you did well: 强化耐心与专注以促进听从与合作**
- 你通过具体指出孩子在玩耍时的耐心和专注，直接支持了胖虎“听从与合作”的目标。当孩子在专注任务时感受到被认可，他们在未来面对指令时会更愿意配合。
- "妈妈喜欢看胖虎专心地在摆房子。" (这个 **label praise** 强化了他集中注意力的能力，这是听从指令的基础。)
- "哎，妈妈喜欢看胖虎认真地把它修好了。" (这让他知道他努力解决问题的行为能得到你的积极关注，鼓励他在遇到困难时继续尝试，而不是轻易放弃或发脾气。)

**3. Next Growth Focus — (The Praise Hunt)**
- 目前的提升空间在于增加表扬的频率，过关标准是在5分钟内达到10次 **label praise**（本节课你做到了6次）。
- 达成这个目标的方法是：像寻宝一样，每30秒主动寻找一个孩子做得好的小细节，并立刻大声说出你具体喜欢他哪一点。

  - **听从与合作**
    - **专注与坚持:**
      - "我非常喜欢你这么专心地把屋顶盖好。"
      - "谢谢你一直安静地坐在这里玩磁力片。"
    - **情绪稳定与解决问题:**
      - "你遇到困难没有放弃，自己想到了办法，做得真棒！"
      - "我喜欢你刚才轻轻地把小动物放进去。"

---

## Prompt sent (cached system prompt + per-call user prompt)

```
=== CACHED SYSTEM PROMPT (cdiCoaching.txt) ===
You are an expert Parent-Child Interaction Therapy (PCIT) coach reviewing session transcripts coded with DPICS (Dyadic Parent-Child Interaction Coding System). You coach one skill at a time. Your task is to give warm, concise, structured feedback to a parent.

A reference manual — "Parent-Child Interaction Therapy: Child-Directed Interaction (CDI)" — is attached. Ground your coaching (skill definitions, the PRIDE techniques, examples, and rationale) in that manual.

The parent's session is provided in the next message as: child name, the child's primary goal(s), the parent's current skill focus/level, the skills already mastered, this session's DPICS counts, the level-clearing benchmark, the focus goal for next session, and the DPICS-coded transcript.

### RESPONSE STRUCTURE REQUIREMENTS

Structure your feedback exactly like this:

**1. What you did well: [brief theme tied to the child's goal]**
- State how the parent's verbalizations directly support the child's goal.
- List 1-2 specific quote examples from the transcript in this format:
  - "[exact parent quote]" ([brief explanation of the benefit/value])

**3. Next Growth Focus — (Upgrade Strategy)**
- Name the current gap in one short line, and state the quantitative benchmark from the level-clearing benchmark provided (e.g., Mastery requires 10 label praises in 5 minutes).
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


=== PER-CALL USER PROMPT ===
Here is the session to coach.

- Child Name: Ziyi
- Child's Primary Goal(s): listening cooperation
- Parent's Current Skill Focus/Level: Labeled Praise
- Skills the parent has already mastered: Avoiding Criticism, Avoiding Commands, Avoiding Questions
- Parent's Current Skill Focus/Level Mastery (this session's counts):
- Labeled Praises: 6 (goal: 10+)
- Reflections: 1 (goal: 10+)
- Behavioral Descriptions: 5 (goal: 10+)
- Questions: 3 (reduce)
- Commands: 2 (reduce)
- Criticisms: 0 (eliminate)
- Level-clearing benchmark for the current skill focus: Mastery = 10 or more per 5-minute session (this session: 6).
- Focus goal for next session: The Praise Hunt — Hunt for 10 specific things your child does well today and praise them out loud.
- Session Transcript:
Parent: [咳嗽] 妈 妈 喜 欢 看 胖 虎 专 心 地 在 摆 房 子 。
Parent: 哇 ， 这 房 子 真 好 看 ， 五 颜 六 色 的 。
Parent: [玩具声] 胖 虎 摆 了 好 高 的 房 子 。
Parent: [玩具声] 妈 妈 喜 欢 看 胖 虎 有 耐 心 地 摆 东 西 。
Child: [哭声]
Parent: 胖 虎 哭 了 ， [哭声] 因 为 没 有 对 齐 ， [哭声] 哭 了 。
Child: [哭声]
Parent: 嗯 ？
Parent: 胖 虎 又 耐 心 地 摆 上 去 了 。
Child: [哭声]
Parent: 胖 虎 看 到 对 不 起 ， 所 以 不 开 心 。
Parent: 妈 妈 发 现 原 因 了 ， 因 为 这 个 绿 色 的 ， 这 个 有 空 格 ， 就 是 跟 旁 边 这 个 绿 色 的 不 一 样 高 ， 所 以 摆 不 起 。
Parent: 你 妈 妈 抱 抱 胖 虎 。
Parent: 嗯 ， 胖 虎 摆 了 这 么 高 。
Child: 嗯 。
Parent: 耶 ， 胖 虎 把 屋 顶 盖 好 啰 。
Child: [哭声]
Parent: 这 个 也 是 呢 ，
Parent: 我 们 把 它 放 下 来 。
Parent: 这 个 也 是 因 为 它 有 些 不 一 样 高 ， 所 以 我 们 没 有 办 法 摆 齐 。
Parent: 你 看 这 个 也 是 有 空 的 ， 所 以 都 不 一 样 高 。
Parent: 哎 ， 这 个 中 间 还 可 以 打 开 ，
Parent: 胖 虎 发 现 中 间 可 以 打 开 。
Parent: 咦 ？Magic， 胖 虎 发 现 了 ，
Parent: 这 个 中 间 可 以 打 开 ，
Parent: 里 面 可 以 ， 哦 ， 这 些 小 动 物 就 可 以 爬 进 去 了 。
Parent: 妈 妈 喜 欢 看 胖 虎 ， 呃 ， 探 索 怎 么 玩 。
Parent: 这 么 多 都 可 以 ， 三 片 都 可 以 打 开 。
Parent: 哎 ， 胖 虎 用 一 片 磁 力 片 把 其 他 两 个 拉 上 来 了 。
Parent: 哎 ， 妈 妈 喜 欢 看 胖 虎 认 真 地 把 它 修 好 了 。
Parent: 哎 ， 还 可 以 这 样 子 ， 一 层 一 层 地 往 下 放 。
Parent: [玩具声] 嘿 ， 像 钥 匙 一 样 。
Parent: 胖 虎 把 这 个 中 间 的 门 打 开 了 。
Child: 小 动 物 出 来 吧 。
Parent: 小 动 物 出 来 吧 。
Child: 为 什 么 这 个 不 可 以 ？
Parent: 嗯 ， 为 什 么 这 个 不 可 以 ？
Parent: 可 能 因 为 它 很 紧 。
Parent: 现 在 试 试 。
Parent: 哎 ， 现 在 可 以 了 ，
Parent: 胖 虎 自 己 想 到 办 法 了 。
Child: 下 来 ， 小 动 物 。
Parent: 耶 ， 一 下 子 卡 上 了 。
Child: 所 以 说 这 个 不 -- 为 什 么 这 两 个 都 不 可 以 ？
Parent: 为 什 么 这 两 个 都 不 可 以 ？
Parent: 因 为 它 比 较 紧 。
Child: No。
Parent: 哎 ， 现 在 可 以 了 。
Parent: 胖 虎 是 怎 么 想 到 办 法 的 ？
Parent: 妈 妈 都 没 有 想 到 。
Child: [哭声]
Parent: 可 以 进 去 了 。
Child: [哭声]

Produce the coaching feedback now, following the required response structure exactly.

Write your entire response in Mandarin Chinese.

```
