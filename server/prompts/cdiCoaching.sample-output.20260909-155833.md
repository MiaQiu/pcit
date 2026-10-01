# cdiCoaching prompt — sample run (JSON output format)

Generated: 2026-09-09 15:58
Script: `server/scripts/run-cdi-coaching.cjs` (now writes model-tagged files, so flash/pro runs no longer clobber each other)
Session: `d01bbcd9-1f72-4b57-a0bf-0f922636b4aa` (Ziyi, 48 mo) — dry run, not persisted
flash vs pro identical: False

**Resolved prompt vars**
- skillname: `Labeled Praise` (parent skill level 4)
- primary_issue: `listening cooperation`
- session counts: praise 5 / echo 8 / narration 7 / question 11 / command 19 / criticism 0
- MASTERY_BENCHMARK: `Mastery = 10 or more per 5-minute session (this session: 5).`
- output language: zh

---

## Output — gemini-3.7-flash  (657 chars, valid JSON)

```json
{
  "did_well": {
    "theme": "抓住积极行为并及时给予肯定",
    "alignment": "您在游戏中敏锐地捕捉到孩子的良好表现并给予label praise，这能帮助孩子明确知道哪些积极行为值得保持，从而促进听从与配合。",
    "examples": [
      {
        "quote": "谢谢胖虎有耐心。",
        "benefit": "具体点出孩子的耐心品质，有效强化了情绪调节与等待能力。"
      },
      {
        "quote": "妈妈喜欢看胖虎自己想办法。",
        "benefit": "明确肯定了孩子的自主探索行为，增强了面对困难时的自信心。"
      }
    ]
  },
  "growth_focus": {
    "gap": "label praise的使用频率尚有提升空间。",
    "benchmark": "达到掌握标准需要在5分钟内完成10次或以上的label praise（本次为5次）。",
    "how_to": "开启“赞扬大搜寻”：细心观察孩子的具体动作，运用“谢谢你/你很棒……”加“具体行为”的句式大声赞扬。",
    "goals": [
      {
        "goal": "听从与配合",
        "categories": [
          {
            "name": "专注与耐心探索",
            "examples": [
              "谢谢胖虎专心地把磁力片轨道拼得这么长。",
              "你真棒，能仔细观察卡住的球并自己动手拿出来。"
            ]
          },
          {
            "name": "听从引导与配合转换",
            "examples": [
              "谢谢胖虎听到提醒就自己去电视柜拿球，配合得真好。",
              "你真守信用，听到还有两分钟就准备收拾去洗澡。"
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

## Output — gemini-3.1-pro-preview  (979 chars, valid JSON)

```json
{
  "did_well": {
    "theme": "用具体表扬强化合作意愿",
    "alignment": "您在游戏中多次准确地表扬了胖虎的具体行为。这能让他清楚地知道自己做对了什么，从而在未来更愿意配合和听从指令。",
    "examples": [
      {
        "quote": "妈妈喜欢看胖虎自己想办法。",
        "benefit": "明确指出了他独立思考的优点，鼓励他继续保持这种好习惯。"
      },
      {
        "quote": "谢谢胖虎有耐心。",
        "benefit": "强化了他的耐心，这对他未来在日常生活中听从指令和控制情绪非常有帮助。"
      }
    ]
  },
  "growth_focus": {
    "gap": "目前具体表扬的次数是5次，同时提问和指令有些多。",
    "benchmark": "达标要求是在5分钟的游戏时间内完成至少10次具体表扬。",
    "how_to": "下周我们进行‘表扬大搜寻’：寻找10个胖虎做得好的具体小事并大声表扬出来，遇到想提问或发指令时，试着改为描述他的动作。",
    "goals": [
      {
        "goal": "听从指令与合作",
        "categories": [
          {
            "name": "具体表扬",
            "examples": [
              "谢谢胖虎把绿色的球递给妈妈！",
              "妈妈很喜欢你这么轻柔地拼搭磁力片！"
            ]
          },
          {
            "name": "行为描述",
            "examples": [
              "胖虎把blender放在了轨道中间。",
              "你找到了那个蓝色的球。"
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
