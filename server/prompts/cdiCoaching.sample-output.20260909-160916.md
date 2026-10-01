# cdiCoaching prompt — sample run (JSON output format)

Generated: 2026-09-09 16:09
Script: `server/scripts/run-cdi-coaching.cjs`
Session: `667ae6fc-702c-46f1-93d6-f1ea2f6e883e` (Ziyi, 48 mo, 301s, 63 utterances) — dry run, not persisted
flash vs pro identical: False

**Resolved prompt vars**
- skillname: `Labeled Praise` (parent skill level 4)
- primary_issue: `listening cooperation`
- session counts: praise 6 / echo 1 / narration 5 / question 3 / command 2 / criticism 0
- MASTERY_BENCHMARK: `Mastery = 10 or more per 5-minute session (this session: 6).`
- output language: zh

---

## Output — gemini-3.7-flash  (latency ~4s, 990 chars, valid JSON)

```json
{
  "did_well": {
    "theme": "用具体的赞美肯定孩子的专注与坚持",
    "alignment": "您在互动中真诚地赞美孩子的耐心和专注，这能让孩子感受到被认可，从而更愿意积极配合与倾听。",
    "examples": [
      {
        "quote": "妈妈喜欢看胖虎专心地在摆房子。",
        "benefit": "清晰指出了孩子“专心”的好行为，增强孩子的自信心和专注力。"
      },
      {
        "quote": "哎，妈妈喜欢看胖虎认真地把它修好了。",
        "benefit": "及时肯定孩子面对困难时的坚持与解决问题的努力。"
      }
    ]
  },
  "growth_focus": {
    "gap": "有针对性的赞美方向很准确，数量上距离达标还需要再增加一些",
    "benchmark": "5分钟内达到10次或更多有针对性的赞美（本次：6次）",
    "how_to": "开启“赞美搜寻模式”，捕捉孩子每一个微小的努力并具体说出来",
    "goals": [
      {
        "goal": "倾听与配合",
        "categories": [
          {
            "name": "面对挫折时的坚持与探索",
            "examples": [
              "谢谢你没有放弃，继续耐心地试着把磁力片对齐！",
              "胖虎太棒了，遇到卡住时自己动脑筋想出了新办法！"
            ]
          },
          {
            "name": "游戏中的专注与平稳情绪",
            "examples": [
              "妈妈喜欢你这么安静、专注地一层一层往下放磁力片。",
              "谢谢你愿意听妈妈说完，慢慢把小门打开。"
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

## Output — gemini-3.1-pro-preview  (latency ~32s, 1009 chars, valid JSON)

```json
{
  "did_well": {
    "theme": "通过具体表扬提升合作意愿",
    "alignment": "您在游戏中多次具体地表扬了Ziyi（胖虎）的耐心和专注。当孩子听到您明确指出他们做对了什么时，他们会更愿意在未来继续保持这些好行为，从而自然而然地提升听从和合作的意愿。",
    "examples": [
      {
        "quote": "妈妈喜欢看胖虎有耐心地摆东西。",
        "benefit": "明确指出了“有耐心”这个具体行为，让孩子清楚知道自己哪里做得好。"
      },
      {
        "quote": "妈妈喜欢看胖虎认真地把它修好了。",
        "benefit": "强化了孩子解决问题和专注的态度，有助于培养遇到困难不放弃的品质。"
      }
    ]
  },
  "growth_focus": {
    "gap": "目前具体表扬的次数（6次）距离目标还有一点点距离。",
    "benchmark": "掌握该技能需要在5分钟内完成10次或以上的具体表扬。",
    "how_to": "下节课的目标是“表扬大搜寻”：在游戏中寻找10件孩子做得好的具体事情，并大声表扬出来。",
    "goals": [
      {
        "goal": "听从合作",
        "categories": [
          {
            "name": "具体表扬",
            "examples": [
              "胖虎，你这么有耐心地把屋顶盖好，做得真棒！",
              "妈妈喜欢看你自己想办法把门打开！"
            ]
          },
          {
            "name": "行为描述",
            "examples": [
              "你把小动物放进房子里了。",
              "胖虎正在一层一层地往下放磁力片。"
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
