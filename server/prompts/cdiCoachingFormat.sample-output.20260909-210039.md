# cdiCoachingFormat — redone (Coach's Corner + Crisis Moment split)

Generated: 2026-09-09 21:00  ·  model: gemini-3.7-flash  ·  dry run

The `coaching-narrative` call produces the markdown write-up (sections 1 / 3 / 4).
`cdiCoachingFormat` then splits it:
- **coach_corner** = section 1 + section 3, combined & reformatted → `coachingPart1` → API `skillCoaching` → mobile Coach's Corner card.
- **tricky_moments** = section 4 as `{summary, points:[{title, explanation, quote, suggested_rewrite}]}` (or null) → `coachingPart2` → API `learningMoments` → mobile crisis slot, rendered in the Image #2 card style (icon badge, bold title, description, quote block, green "Try saying instead").

---

### Session 4b7322d5 (criticism 3 — has a tricky moment)

**coachingPart1 → Coach's Corner**

**积极肯定倾听与配合行为**

你的积极反馈清晰地向孩子传达了哪些行为是被认可的，帮助孩子建立对积极互动的良好体验，从而更有意愿**主动倾听与配合**。

• 「谢谢Ziyi给妈妈分一下 ice cream。」（明确指出了孩子**主动分享**的动作，让孩子明白分享是被看见和欣赏的，有效强化了合作意愿。）
• 「谢谢Ziyi有耐心。」（具体肯定了孩子在小猫走近时的**平静与等待**，帮助孩子巩固耐心配合的好习惯。）

**下一步成长重点**

本次互动中使用了 3 次 **label praise**，距离达标基准（5 分钟内达到 10 次或以上）还有一定提升空间。

**提升小公式**：**称赞词 + 具体的正面动作**。在游戏中像探照灯一样时刻捕捉孩子正在做的好行为，争取每 30 秒就送出一个及时的 **label praise**。

**配合与倾听**

**温和互动与分享**
• 「谢谢你温柔地把绿色大屋顶递给妈妈，配合得真好！」
• 「你愿意把好吃的冰淇淋分给妈妈，真是个贴心又乐于分享的好帮手！」

**专注倾听与跟随**
• 「谢谢你认真听妈妈说话，马上就看向妈妈，太棒了！」
• 「妈妈一说搭积木，你就专心地坐好一起搭，听得真仔细！」

**coachingPart2 → Crisis Moment slot** (1 point(s))

```json
{
  "summary": "在特殊游戏时间减少直接否定与负面关注，有助于守护孩子的游戏主导权并减少对抗行为。",
  "points": [
    {
      "title": "搭好的房子被推倒",
      "explanation": "Ziyi在玩耍时不小心推倒了刚搭好的房子，你表达了包含「不可以」的否定指令。直接否定容易打断孩子的游戏投入，建议先平静重搭示范，待孩子动作轻柔时立即给予表扬。",
      "quote": "妈妈告诉胖虎说，不可以推倒我的房子。",
      "suggestedRewrite": "妈妈重新把积木搭好，谢谢你现在轻轻地拿积木，对玩具很温柔。"
    }
  ]
}
```


---

### Session 662dd15b (clean session — no tricky moment)

**coachingPart1 → Coach's Corner**

**通过积极关注建立良好的配合基础**

你的语言充满了温暖与接纳，全程没有提问、命令或批评，给Ziyi创造了一个完全由他主导的安全空间。这种积极的互动氛围极大地保护了Ziyi的自主感，让他更愿意敞开心扉、主动与你配合。

• “妈妈喜欢看Ziyi认真摆房子。”（具体肯定了孩子的**专注与投入**，让Ziyi感受到自己的努力被看见，增强了后续配合的意愿。）
• “妈妈喜欢看Ziyi掉的东西，也不着急补回来。”（精准捕捉到了孩子面对小意外时的**平稳心态**，帮助Ziyi强化面对挫折时的耐心与情绪调节。）

**下一步成长重点 — 进阶策略**

目前你在5分钟内完成了3次**标定赞美**，距离达到10次及以上的掌握标准还有提升空间。

**达成方法**
运用简单的“赞美公式”——【赞赏表达 + 具体的动作/良好品质】。试着每30秒捕捉一个微小的积极行为，立刻大声、具体地夸出来。

**倾听与配合**

**主动沟通与分享想法**
• “谢谢你主动告诉妈妈这是怪兽的房子，你的表达真清楚！”
• “你愿意把自己的搭建创意分享给妈妈，真是个贴心的小帮手！”

**专注坚持与平稳调整**
• “你把两个房子用桥连在一起时特别有耐心，手放得好稳！”
• “积木碰倒了你也完全不着急，一直在专心想办法，这份坚持太棒了！”

**coachingPart2 → Crisis Moment slot** (null)

```json
null
```

