# cdiCoaching prompt — sample run (JSON output format)

Generated: 2026-09-09 15:54
Script: `server/scripts/run-cdi-coaching.cjs`
Session: `d01bbcd9-1f72-4b57-a0bf-0f922636b4aa` (Ziyi, 48 mo) — dry run, not persisted
Prompt: JSON structured-sections format; profile still `output:'text'`.

**Resolved prompt vars**
- skillname: `Labeled Praise` (parent skill level 4)
- primary_issue: `listening cooperation`
- session counts: praise 5 / echo 8 / narration 7 / question 11 / command 19 / criticism 0
- MASTERY_BENCHMARK: `Mastery = 10 or more per 5-minute session (this session: 5).`
- output language: zh

---

## Output — gemini-3.7-flash  (latency ~7.5s, 997 chars, valid JSON)

```json
{
  "did_well": {
    "theme": "用具体的赞美肯定孩子的耐心与自主探索",
    "alignment": "当您具体指出并夸奖孩子的良好行为时，能清晰让孩子明白什么是期望行为，从而大大提升倾听与配合的意愿。",
    "examples": [
      {
        "quote": "谢谢胖虎有耐心。",
        "benefit": "精准肯定了孩子等待和情绪调节的能力，有助于增强自我控制与配合意愿。"
      },
      {
        "quote": "妈妈喜欢看胖虎自己想办法。",
        "benefit": "具体赞许了孩子的独立探索，鼓励孩子在活动中保持积极专注。"
      }
    ]
  },
  "growth_focus": {
    "gap": "本次使用了5次具名赞美，距离达标还需要增加5次",
    "benchmark": "5分钟内完成10次或以上的具名赞美（本次：5次）",
    "how_to": "开展“赞美寻宝”：留心捕捉孩子做到的具体小举动，用“谢谢你/你很棒+具体行为”大声说出来。",
    "goals": [
      {
        "goal": "倾听配合",
        "categories": [
          {
            "name": "积极配合活动转换",
            "examples": [
              "谢谢胖虎商量好两分钟就准备去洗澡，真配合！",
              "胖虎听到提醒就主动把手里的球收好，听得真仔细！"
            ]
          },
          {
            "name": "专注与耐心地探索",
            "examples": [
              "谢谢胖虎这么有耐心地把磁力片轨道搭得这么长！",
              "胖虎很专心地自己把卡住的球拿出来，真会想办法！"
            ]
          }
        ]
      }
    ]
  },
  "tricky_moments": null
}
```

---

## Output — gemini-3.1-pro-preview  (latency ~24s, 1022 chars, valid JSON)

```json
{
  "did_well": {
    "theme": "肯定孩子的努力与耐心，促进听从合作",
    "alignment": "您在游戏中敏锐地捕捉到了胖虎的好行为并给予了具体的表扬。这能让孩子清楚地知道自己哪里做得好，从而更乐意在未来继续保持合作。",
    "examples": [
      {
        "quote": "妈妈喜欢看胖虎自己想办法。",
        "benefit": "鼓励孩子独立思考，增强自信心，减少对父母指令的依赖。"
      },
      {
        "quote": "谢谢胖虎有耐心。",
        "benefit": "强化了孩子在遇到小挫折时的情绪控制，有助于培养顺从与合作的态度。"
      }
    ]
  },
  "growth_focus": {
    "gap": "我们需要进一步增加“具体表扬”的频率，并用表扬代替游戏中的提问和指令。",
    "benchmark": "掌握这项技能需要在5分钟的游戏内给出至少10次具体表扬（本次得分为5次）。",
    "how_to": "开启“表扬雷达”：寻找10个孩子做得好的具体细节（如安静玩耍、分享、听话），并大声说出“谢谢你...”或“我喜欢你...”。",
    "goals": [
      {
        "goal": "听从合作",
        "categories": [
          {
            "name": "具体表扬",
            "examples": [
              "谢谢胖虎这么快就把蓝色的球找出来了！",
              "我喜欢胖虎这么配合地告诉我还有两分钟去洗澡。"
            ]
          },
          {
            "name": "行为描述",
            "examples": [
              "胖虎在用磁力片搭一个很长的轨道。",
              "胖虎把绿色的球放在了切菜板旁边。"
            ]
          }
        ]
      }
    ]
  },
  "tricky_moments": null
}
```

Note: pro again used skill names (具体表扬 / 行为描述) for `growth_focus.goals[].categories[].name`; flash used child-goal sub-categories (积极配合活动转换 / 专注与耐心地探索).

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
