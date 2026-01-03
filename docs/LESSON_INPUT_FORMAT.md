# Lesson Input Format Guide

This document describes the text format used in lesson source files (e.g., `lessons-formatted.txt`) that get imported into the Nora application.

---

## Table of Contents
- [File Structure](#file-structure)
- [Formatting Syntax](#formatting-syntax)
- [Content Guidelines](#content-guidelines)
- [Examples](#examples)
- [Common Mistakes](#common-mistakes)

---

## File Structure

### Overall Organization

```
Phase 1: Connect (Days 1–22)

Day 1: Lesson Title
Short description sentence here.
Card 1: Section Title
Body text content...
Card 2: Section Title
Body text content...
Day 1 Quiz
Q: Question text?
A. Option A text
B. Option B text
C. Option C text
D. Option D text
Correct Answer: B
Reason: Explanation text

Day 2: Next Lesson Title
...

Phase 2: Discipline (Days 1–26)

Day 1: Lesson Title
...
```

### Required Elements

1. **Phase Header**: `Phase X: Phase Name (Days X–Y)`
2. **Day Header**: `Day X: Lesson Title`
3. **Short Description**: One sentence summary (required, appears after day header)
4. **Cards**: `Card X: Section Title` followed by body text
5. **Quiz**: `Day X Quiz` section with question, 4 options, correct answer, and reason

---

## Formatting Syntax

### Line Breaks and Spacing

**Single newline (`\n`)**:
- Creates a line break with 10px bottom margin
- Use between related sentences or items

**Double newline (`\n\n`)**:
- Creates paragraph spacing (8px gap)
- Use to separate distinct ideas or sections

Example:
```
This is sentence one.

This is a new paragraph after spacing.
```

### Bullet Points

**Format**: Use asterisk followed by space (`* `)
- Each bullet appears on its own line
- Display as purple `•` character (fontSize: 20, color: mainPurple)
- Automatically get 10px bottom margin and proper indentation

Example:
```
* First bullet point
* Second bullet point
* Third bullet point
```

**Single Bullet Rule**:
- If a card has only ONE bullet point, remove the `*` marker
- Single bullets display as regular text, not as a list item

Example:
```
❌ WRONG (single bullet):
* Tip: This is the only point.

✅ CORRECT (single bullet):
Tip: This is the only point.
```

### Bold Text

**Format**: Use double asterisks (`**text**`)
- Use for key concepts, techniques, and important terms
- Select 2-5 keywords per card for emphasis
- Bold formatting helps readers quickly scan content

Example:
```
This is **Special Play Time**, a key practice in **Phase 1: Connect**.
```

**What to Bold**:
- ✅ Key parenting techniques (Special Play Time, PEN skills, Time-Out)
- ✅ Important numbers (5 minutes, 10 praises, 3 minutes + 5 seconds)
- ✅ Phase names (Connect, Discipline)
- ✅ Critical concepts (Extinction Burst, Positive Opposite)
- ✅ First mentions of new terminology
- ❌ Common words or articles
- ❌ Every instance of the same word
- ❌ Entire sentences

**Numbered Rules/Steps**:
- Numbers at start of lines are automatically bolded by import script
- Format: `1. ` becomes `**1.** `

### Quiz Format

**Structure**:
```
Day X Quiz
Q: Question text here?
A. First option text
B. Second option text
C. Third option text
D. Fourth option text
Correct Answer: B
Reason: Explanation of why B is correct
```

**Requirements**:
- Must have exactly 4 options (A, B, C, D)
- Use period after letter: `A.` not `A)` or `A:`
- Correct Answer must reference the letter only
- Reason should be 1-2 sentences

---

## Content Guidelines

### Card Content Best Practices

1. **Keep it concise**: 50-150 words per card optimal
2. **Use active voice**: "Practice daily" not "Daily practice should be done"
3. **Break up text**: Use line breaks and bullets for readability
4. **Highlight key terms**: Bold 2-5 important concepts per card
5. **Avoid walls of text**: Use paragraph breaks (`\n\n`)

### Writing Style

- **Tone**: Supportive, encouraging, instructional
- **Person**: Second person ("you", "your child")
- **Tense**: Present tense for general advice, future for instructions
- **Sentence length**: Mix short (5-10 words) and medium (15-20 words)

### Content Types

The import script infers content type based on section title and content:

| ContentType | Triggers | Purpose |
|-------------|----------|---------|
| **TIP** | "Tip:", "Practice Tip:" | Practical advice |
| **EXAMPLE** | "Example:", "Scenario:" | Sample situations |
| **SCRIPT** | "Script:", "Sample Script:" | Dialogue templates |
| **CALLOUT** | "Important:", "Remember:", "Warning:" | Critical information |
| **TEXT** | Default | General information |

---

## Examples

### Complete Lesson Example

```
Day 5: Handling Whining
Learn to use Selective Ignoring to reduce attention-seeking behaviors while maintaining connection.

Card 1: What is Selective Ignoring?
**Selective Ignoring** means withdrawing attention from minor misbehaviors that are designed to get a reaction.

When your child whines, complains, or nags, they are testing to see if negative behavior gets your attention.

By ignoring it calmly, you teach them that **positive behavior** gets attention, not negative.

Card 2: How to Practice
When whining starts:
* Continue what you're doing without reacting
* Keep your face neutral
* Don't make eye contact

When the whining stops, **immediately** return to warm engagement and praise.

Card 3: The Extinction Burst
Warning: Behavior may get worse before it gets better.

This temporary increase is called an **Extinction Burst**—your child is testing if the old pattern still works.

Stay consistent. The behavior will decrease if you don't give in.

Day 5 Quiz
Q: Why does behavior sometimes get worse when you start ignoring it?
A. Because the child is angry at you.
B. Because ignoring doesn't work.
C. Because the child is testing if the old pattern still works (Extinction Burst).
D. Because you're doing it wrong.
Correct Answer: C
Reason: The Extinction Burst is a normal, temporary increase in unwanted behavior as the child tests whether the old attention-seeking strategy still works.
```

### Formatting Examples

**Good bullet usage** (3+ items):
```
Card 2: The Rules
* Time: 5 minutes daily
* Child Leads: They choose the activity
* Right Toys: Use blocks, dolls, Play-Doh
* Your Job: Follow their lead
```

**Remove bullet** (single item):
```
Card 3: Practice Tip
Tip: Set a timer so you don't have to watch the clock.
```

**Bold emphasis**:
```
The **5-Second Wait** is critical. Give one command, then wait **5 full seconds** before repeating.
```

**Paragraph spacing**:
```
First concept explained here.

Second concept with visual space above it.

Third distinct idea after another space.
```

---

## Common Mistakes

### ❌ Mistake 1: Inconsistent bullet format
```
• Using different bullet characters
* Mixing asterisks
- And dashes
```
✅ **Fix**: Use only `* ` (asterisk + space)

### ❌ Mistake 2: Over-bolding
```
This is **Special** **Play** **Time**, **a** **key** **practice**.
```
✅ **Fix**: `This is **Special Play Time**, a key practice.`

### ❌ Mistake 3: Missing line breaks
```
First sentence.Second sentence.Third sentence.
```
✅ **Fix**: Add `\n` between sentences for readability

### ❌ Mistake 4: Single bullet not removed
```
* Tip: This is the only point in the card.
```
✅ **Fix**: `Tip: This is the only point in the card.`

### ❌ Mistake 5: Quiz format errors
```
A) Option text          ← Wrong: use A. not A)
Correct Answer: Option A ← Wrong: use letter only (A)
```
✅ **Fix**:
```
A. Option text
Correct Answer: A
```

### ❌ Mistake 6: Missing short description
```
Day 1: Lesson Title
Card 1: First Card     ← Missing description!
```
✅ **Fix**:
```
Day 1: Lesson Title
Learn the foundation of the approach.
Card 1: First Card
```

---

## Technical Details

### How Text is Processed

1. **Import Script** (`scripts/import-all-lessons.cjs`):
   - Parses the text file structure
   - Extracts lessons, cards, and quizzes
   - Converts `●` to `*` for bullets (if needed)
   - Preserves `**bold**` markdown
   - Stores in database with `\n` for line breaks

2. **Mobile App** (`LessonViewerScreen.tsx`):
   - Splits text by `\n` into lines
   - Matches `^* ` pattern for bullets
   - Renders bullets as purple `•` (fontSize: 20)
   - Converts `**text**` to bold inline text
   - Creates spacing for empty lines

### Database Storage

- **Field**: `LessonSegment.bodyText` (String/Text)
- **Format**: Plain text with `\n` for newlines and `**` for bold
- **Bullet marker**: `*` (asterisk, converted to `•` at render time)
- **No HTML**: Pure text with markdown-style formatting only

---

## Workflow

### Creating New Lessons

1. **Write in text format** following this guide
2. **Review formatting**: Check bullets, bold, spacing
3. **Remove single bullets**: Find cards with one `*` and remove it
4. **Add bold keywords**: Identify 2-5 key terms per card
5. **Verify quiz format**: Check A./B./C./D. structure
6. **Run import script**: `node scripts/import-all-lessons.cjs`

### Updating Existing Lessons

1. **Edit source file** (`lessons-formatted.txt`)
2. **Update specific card** (if needed):
   ```bash
   node scripts/update-specific-card.cjs [phase] [day] [card]
   ```
3. **Or full re-import**:
   ```bash
   node scripts/import-all-lessons.cjs
   ```

---

## Quick Reference

| Element | Format | Example |
|---------|--------|---------|
| Phase Header | `Phase X: Name (Days X–Y)` | `Phase 1: Connect (Days 1–22)` |
| Day Header | `Day X: Title` | `Day 5: Handling Whining` |
| Short Description | One sentence after day header | `Learn to use Selective Ignoring.` |
| Card Header | `Card X: Title` | `Card 2: How to Practice` |
| Line break | `\n` | (single newline) |
| Paragraph spacing | `\n\n` | (double newline) |
| Bullet | `* Item` | `* First bullet point` |
| Bold | `**text**` | `**Special Play Time**` |
| Quiz Header | `Day X Quiz` | `Day 5 Quiz` |
| Quiz Question | `Q: Question?` | `Q: What is PEN?` |
| Quiz Options | `A. Text` | `A. Praise, Echo, Narrate` |
| Correct Answer | `Correct Answer: A` | `Correct Answer: B` |
| Explanation | `Reason: Text` | `Reason: PEN stands for...` |

---

## Related Files

- **Source File**: `/Users/mia/Downloads/lessons-formatted.txt`
- **Import Script**: `/Users/mia/nora/scripts/import-all-lessons.cjs`
- **Schema**: `/Users/mia/nora/prisma/schema.prisma`
- **Renderer**: `/Users/mia/nora/nora-mobile/src/screens/LessonViewerScreen.tsx`
- **Update Guide**: `/Users/mia/nora/docs/LESSON_UPDATE_GUIDE.md`

---

**Last Updated**: January 2026
