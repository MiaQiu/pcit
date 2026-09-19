# cdiCoaching prompt — sample run (new prompt)

Generated: 2026-09-09 15:43
Script: `server/scripts/run-cdi-coaching.cjs`
Session: `d01bbcd9-1f72-4b57-a0bf-0f922636b4aa` (Ziyi, 48 mo) — dry run, not persisted

**Resolved prompt vars**
- skillname: `Labeled Praise` (parent skill level 4)
- passed levels: `Avoiding Criticism, Avoiding Commands, Avoiding Questions`
- primary_issue: `listening cooperation`
- session counts: praise 5 / echo 8 / narration 7 / question 11 / command 19 / criticism 0
- MASTERY_BENCHMARK: `Mastery = 10 or more per 5-minute session (this session: 5).`
- output language: zh (session language), forced by LANGUAGE_INSTRUCTION

Micro-behavior category headings now render as the bare category name (no "微小行为 1/2：" prefix).

---

## Output — gemini-3.7-flash

- output 554 chars

**1. What you did well: 及时肯定积极行为，增强配合与专注**
- 你在游戏中敏锐地捕捉到了孩子的良好表现并给出了清晰的肯定，这种**label praise**能让孩子明确知道哪些行为是被赞赏的，从而更愿意积极倾听与配合。
- “谢谢胖虎有耐心。”（具体指出了孩子的耐心品质，有效强化了面对意外变故时的冷静与配合。）
- “妈妈喜欢看胖虎自己想办法。”（明确肯定了孩子独立思考与探索的行为，增强了孩子的自信心与合作意愿。）

**3. Next Growth Focus — (Upgrade Strategy)**
- 本次互动完成了 5 次 **label praise**，达标标准为 5 分钟内达到 10 次或以上。
- **达成策略（赞美大搜寻）：** 在游戏中主动搜寻孩子的积极动作，运用公式“谢谢你/你很棒 + [具体行为]”直接说出赞美。

- **倾听与配合**
  - **主动沟通与等待**
    - “谢谢你听到还要两分钟就点头答应，配合得真棒！”
    - “谢谢你耐心等待爸爸拿道具，没有着急。”
  - **专注探索与收纳**
    - “你把磁力片稳稳地接在轨道上，动作真轻柔！”
    - “谢谢你主动帮忙在盒子里找球，真是个得力的小帮手！”

---

## Output — gemini-3.1-pro-preview

- output 460 chars
- (recovered from terminal log — see correction note at end of file)

**1. 做得好的地方：通过关注积极行为来促进合作**
* 当你明确表扬Ziyi（胖虎）的具体好行为时，他能清楚地知道哪些行为会得到你的积极关注，这会让他未来更愿意听从指令并与你合作。
* “妈妈喜欢看胖虎自己想办法。”（强化了他的独立性和解决问题的能力，这有助于减少挫败感并培养合作意愿。）
* “谢谢胖虎有耐心。”（直接奖励了他在遇到小意外时的情绪稳定，这是良好合作与听从指令的关键基础。）

**3. 下一步成长重点 — (升级策略)**
* 你今天做得非常棒，但要达到精通水平，目标是在5分钟内给出10次以上的**具体表扬**（今天你做到了5次！）。
* **策略：表扬大搜寻 (The Praise Hunt)** —— 今天去寻找10件孩子做得好的具体事情，并大声表扬出来。你可以使用这个简单的公式：“谢谢你/我喜欢你 + [具体的行为]”。

* **听从指令与合作**
  * **专注与解决问题:**
    * “我喜欢你这么专注地搭这个长长的轨道！”
    * “谢谢你自己想办法把蓝色的球拿出来！”
  * **情绪稳定与温和互动:**
    * “球滚下来了你也没有生气，谢谢你这么有耐心！”
    * “我喜欢你轻轻地把磁力片放在中间。”

---

## Correction note

The pro section above was originally a duplicate of the flash output: this run executed pro first, then flash, and both `run-cdi-coaching.cjs` invocations write to the same `scratch/cdi-coaching/coaching-result.json`, so flash overwrote pro's result before it was saved. The pro block has since been restored from the terminal log. Later sample files (`154755`, `155421`) run flash first then copy its result aside before the pro run, so they are not affected.

## Fully resolved prompt (as sent to the model)

```
You are an expert Parent-Child Interaction Therapy (PCIT) coach reviewing session transcripts coded with DPICS (Dyadic Parent-Child Interaction Coding System). You coach one skill at a time. Your task is to give warm, concise, structured feedback to a parent.

### INPUT VARIABLES

- Child Name: Ziyi
- Child's Primary Goal(s): listening cooperation
- Parent's Current Skill Focus/Level: Labeled Praise
- Skills the parent has already mastered: Avoiding Criticism, Avoiding Commands, Avoiding Questions
- Parent's Current Skill Focus/Level Mastery (this session's counts):
- Labeled Praises: 5 (goal: 10+)
- Reflections: 8 (goal: 10+)
- Behavioral Descriptions: 7 (goal: 10+)
- Questions: 11 (reduce)
- Commands: 19 (reduce)
- Criticisms: 0 (eliminate)
- Level-clearing benchmark for the current skill focus: Mastery = 10 or more per 5-minute session (this session: 5).
- Focus goal for next session: The Praise Hunt — Hunt for 10 specific things your child does well today and praise them out loud.
- Session Transcript:
Parent: 胖 虎 知 道 这 是 一 个 叫 blender。
Parent: 看 ， 看 胖 虎 在 轨 道 中 间 放 了 一 个 blender。
Child: 这 个 blender。
Parent: 好 了 。
Parent: 从 这 放 吧 。
Parent: 来 ， 这 样 ， 这 样 比 较 有 ， 快 点 。
Parent: 哎 呦 ， 来 这 了 。
Child: 我 要 blender。
Parent: Blender。
Parent: 胖 虎 想 要 blender。
Child: 刚 才 在 这 里 。
Parent: 哎 呀 ， 等 会 啊 。
Parent: 哎 ， 好 啦 ， 试 试 吧 。
Parent: 哎 呀 。
Parent: 嗯 ？
Parent: 嘟 。
Parent: 哎 ？
Parent: 把 一 个 -
Child: 这 个 是 blender。
Parent: 那 个 是 blender。
Parent: 你 这 ， 卡 住 了 。
Child: 这 个 不 可 以 动 ， 因 为 这 个 cover 了 。
Parent: 啊 ， 这 个 不 可 以 动 ， 因 为 这 个 cover， 这 个 盖 住 了 。
Child: 这 个 也 是 。
Parent: 这 个 也 是 。
Child: 看 ， 胖 虎 ， 胖 虎 给 你 ， 给 胖 虎 ， 给 胖 虎 ， 给 胖 虎 。
Parent: 整 个 都 给 胖 虎 。
Child: 看 ， 看 。
Parent: 哎 ， 胖 虎 想 靠 磁 力 片 的 中 间 放 下 去 球 呢 。
Parent: 嘿 嘿 ， 胖 虎 在 变 魔 术 。
Child: 他 在 变 魔 术 。
Parent: 胖 虎 在 变 魔 术 。
Parent: 变 魔 术 是 不 是 就 这 种 道 具 ？
Parent: 嗯 。
Child: 哦 ， 那 我 不 可 以 了 ， 这 个 没 有 ， 没 有 了 。
Child: 我 先 看 看 。
Parent: 胖 虎 的 磁 力 片 满 了 。
Parent: 啊 ， 这 么 多 球 一 下 子 都 跑 出 来 咯 。
Child: [叫声] 绿 色 的 球 。
Parent: 绿 色 在 这 。
Parent: 胖 虎 在 找 绿 色 的 球 ，
Parent: 绿 色 的 球 在 菜 菜 板 这 边 ， 切 菜 板 这 边 。
Child: 啊 。
Parent: 起 来 啦 ， 胖 胖 要 去 洗 澡 吧 。
Parent: 来 。
Child: 那 ， 那 不 行 了 ， 那 个 球 蓝 色 的 ， 蓝 色 。
Parent: 蓝 色 的 球 在 电 视 柜 里 。
Child: 真 的 。
Parent: 你 看 你 自 己 拿 吧 。
Parent: 胖 虎 自 己 想 办 法 。
Parent: 胖 虎 都 能 记 住 有 什 么 颜 色 的 球 。
Parent: 哎 ， 胖 虎 在 想 办 法 把 这 个 球 拿 出 来 。
Parent: 妈 妈 喜 欢 看 胖 虎 自 己 想 办 法 。
Parent: 耶 ！
Parent: 胖 虎 拿 出 来 了 。
Parent: 等 一 下 。
Parent: 我 这 个 嘴 巴 ， 我 。
Parent: 等 一 下 。
Parent: 妈 妈 有 一 个 想 法 。
Parent: 等 一 下 胖 虎 可 以 拿 着 这 个 去 洗 澡 ， 你 出 来 倒 水 。
Child: Good job。
Parent: Good job， 谢 谢 胖 虎 表 扬 妈 妈 。
Parent: 水 不 会 漏 吗 ？
Child: 嗯 。
Parent: 你 出 去 试 试 吧 。
Child: 嗯 。
Child: 嗯 。
Parent: 嗯 ？
Parent: 啥 意 思 ？
Parent: 嗯 啥 意 思 ？
Parent: 啊 ？
Child: 嗯 。
Parent: 嗯 ， 等 一 下 ， 爸 爸 帮 你 啊 。
Parent: 那 你 说 的 喔 ， 喔 。
Parent: [笑]
Parent: 那 ， 那 爸 爸 给 你 拿 个 这 个 ， 拿 着 这 个 就 去 ， 去 洗 澡 。
Child: 嗯 。
Parent: 你 问 妈 妈 。
Parent: 你 ， 有 ， 还 有 两 分 钟 的 时 间 。
Parent: 好 嘞 。
Child: 两 分 钟 。
Parent: OK， 两 分 钟 ， 胖 虎 说 两 分 钟 之 后 去 洗 澡 。
Parent: [笑] 洗 澡 。
Parent: 胖 虎 在 找 球 ，
Child: 球 呢 ？
Parent: 有 。
Parent: 球 在 盒 子 里 。
Parent: 胖 虎 起 来 ， 胖 虎 起 来 。
Parent: 耶 ！
Parent: 哇 ， 胖 虎 摆 了 一 个 这 么 长 的 轨 道 。
Parent: [笑] 小 胖 胖 。
Parent: 好 了 。
Child: 嗯 ？
Parent: 哎 ？
Parent: 胖 虎 的 球 滚 了 下 来 。
Parent: 喂 ？
Parent: 啊 没 事 ， 可 以 再 弄 上 去 。
Parent: 谢 谢 胖 虎 有 耐 心 。
Parent: 饺 子 给 胖 虎 把 东 西 弄 倒 了 。
Parent: 胖 虎 。
Child: 看 。
Parent: 又 玩 起 来 了 。
Child: 哎 。
Parent: 又 回 去 了 又 。
Parent: [笑] 哎 ， 这 明 天 拿 给 阿 姨 看 吗 ？
Parent: 妈 妈 喜 欢 看 胖 虎 在 仔 细 观 察 。

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
