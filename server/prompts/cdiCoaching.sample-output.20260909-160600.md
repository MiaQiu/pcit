# cdiCoaching prompt — sample run (JSON output format)

Generated: 2026-09-09 16:06
Script: `server/scripts/run-cdi-coaching.cjs`
Session: `4b7322d5-f391-4d49-b58e-9ae6ce8c843f` (Ziyi, 48 mo, 301s, 41 utterances) — dry run, not persisted
flash vs pro identical: False

**Resolved prompt vars**
- skillname: `Labeled Praise` (parent skill level 4)
- primary_issue: `listening cooperation`
- session counts: praise 3 / echo 1 / narration 5 / question 1 / command 1 / criticism 3
- MASTERY_BENCHMARK: `Mastery = 10 or more per 5-minute session (this session: 3).`
- output language: zh
- Note: criticism 3 this session — both models populated `tricky_moments`.

---

## Output — gemini-3.7-flash  (latency ~6s, 1168 chars, valid JSON)

```json
{
  "did_well": {
    "theme": "敏锐捕捉孩子的分享与耐心表现",
    "alignment": "您在互动中及时肯定了孩子的积极行为，这能极大地促进孩子的倾听意愿与配合度。",
    "examples": [
      {
        "quote": "谢 谢 胖 虎 给 妈 妈 分 一 下 ice cream。",
        "benefit": "具体肯定了孩子的分享举动，强化了主动合作的意识。"
      },
      {
        "quote": "谢 谢 胖 虎 有 耐 心 。",
        "benefit": "明确赞扬了耐心等待的品质，帮助孩子建立更好的自我调节能力。"
      }
    ]
  },
  "growth_focus": {
    "gap": "具名赞美（label praise）的频率还可以进一步提高，以激发更多配合行为。",
    "benchmark": "在5分钟互动中达到10次或以上的具名赞美（本次为3次）。",
    "how_to": "开启‘赞美大搜寻’：主动捕捉孩子做出的每一个微小良好行为，套用‘谢谢你/你好棒 + 具体动作’大声夸出来。",
    "goals": [
      {
        "goal": "倾听与合作",
        "categories": [
          {
            "name": "温和互动与平稳操作",
            "examples": [
              "谢谢你这么轻柔地把磁力片放在地上。",
              "你很小心地对待小猫饺子，真棒！"
            ]
          },
          {
            "name": "积极参与与专注搭建",
            "examples": [
              "谢谢你给妈妈加了一个漂亮的绿色大屋顶！",
              "你很认真地在搭新的积木造型，太厉害了。"
            ]
          }
        ]
      }
    ]
  },
  "tricky_moments": {
    "situation": "孩子推倒积木时，妈妈感到难过并进行了言语制止。",
    "tips": [
      "面对轻微的破坏或推倒行为，先深呼吸并尝试短暂的策略性忽略，不给予过多的情绪关注。",
      "一旦孩子重新开始平静搭建或专注玩耍，立刻用具名赞美关注他的良好行为。"
    ]
  }
}
```

---

## Output — gemini-3.1-pro-preview  (latency ~27s, 1162 chars, valid JSON)

```json
{
  "did_well": {
    "theme": "及时捕捉并肯定孩子的友好行为",
    "alignment": "当您具体地表扬胖虎的分享和耐心时，您在明确告诉他哪些行为是受欢迎的。这能极大地促进他的倾听与合作意愿。",
    "examples": [
      {
        "quote": "谢谢胖虎给妈妈分一下ice cream。",
        "benefit": "明确肯定了分享行为，让孩子清楚地知道合作是被赞赏的。"
      },
      {
        "quote": "谢谢胖虎有耐心。",
        "benefit": "及时捕捉到了孩子情绪稳定的瞬间，强化了他耐心包容的品质。"
      }
    ]
  },
  "growth_focus": {
    "gap": "目前我们在5分钟内使用了3次具体表扬，距离目标还有一点距离。",
    "benchmark": "通关标准是：在5分钟的练习内，使用10次或以上的具体表扬。",
    "how_to": "下节课的重点是‘表扬大搜寻’：主动寻找10件孩子做得好的具体小事，并大声表扬出来。",
    "goals": [
      {
        "goal": "倾听与合作",
        "categories": [
          {
            "name": "具体表扬合作行为",
            "examples": [
              "谢谢你帮妈妈给房子加了一个绿色的屋顶！",
              "妈妈很喜欢你愿意和妈妈一起分享磁力片。"
            ]
          },
          {
            "name": "具体表扬情绪与专注",
            "examples": [
              "谢谢你在小狗踩到玩具时保持耐心！",
              "你这么专心地搭积木，真是太棒了！"
            ]
          }
        ]
      }
    ]
  },
  "tricky_moments": {
    "situation": "当胖虎推倒妈妈搭的房子时，出现了一些小摩擦和批评。",
    "tips": [
      "尝试对这类无危险的破坏行为保持中立，避免批评或说教（如‘不可以推倒我的房子’）。",
      "您可以直接描述他接下来的积极行为，或者转身去玩自己的玩具，直到他再次展现合作行为时立刻给予具体表扬。"
    ]
  }
}
```

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

### RESPONSE FORMAT

Return ONLY a single valid JSON object — no markdown, no code fences, no text before or after it. Use exactly this shape:

{
  "did_well": {
    "theme": "brief theme tied to the child's goal",
    "alignment": "1-2 sentences on how the parent's verbalizations directly support the child's goal",
    "examples": [
      { "quote": "exact parent quote from the transcript", "benefit": "brief explanation of the benefit/value" }
    ]
  },
  "growth_focus": {
    "gap": "the current gap in one short line",
    "benchmark": "the quantitative benchmark, taken from the level-clearing benchmark above (e.g. Mastery requires 10 label praises in 5 minutes)",
    "how_to": "very brief — one key strategy or simple formula for hitting the target",
    "goals": [
      {
        "goal": "a primary child goal",
        "categories": [
          { "name": "category name only — no number, no 'micro-behavior' prefix, no label", "examples": ["what the parent can say next time", "another example"] }
        ]
      }
    ]
  },
  "tricky_moments": null or { "situation": "what went off-track, one line", "tips": ["short actionable tip", "another short tip"] }
}

Rules for the fields:
- "did_well.examples": 1-2 items.
- "growth_focus.goals": one entry per primary child goal; each with exactly 2 "categories"; each category with exactly 2 "examples". The examples must be grounded in that category, the current skill focus, and what actually happened in this session.
- "tricky_moments": keep it null UNLESS the play had off-track moments (wrong toys for child-led play, whining, or conflict) AND the parent seemed stressed or uncomfortable in them. If the moments were minor and handled fine, leave it null. When warranted, use:
  { "situation": "what went off-track, one line", "tips": ["short actionable tip", "another short tip"] }
- Every string value must be in the output language specified below.

### TONE AND STYLE

- Warm, encouraging, and clinically precise (DPICS grounded), but easy for a parent to read.
- No jargon, no meta-announcements, no long paragraphs — keep every field short.
- Do NOT mention "PCIT".
- For the PRIDE skills, use these names only: "label praise", "narration", and "echo".
- Keep all coaching short and easy for a parent to understand.

Write your entire response in Mandarin Chinese.

```
