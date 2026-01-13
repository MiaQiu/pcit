# Keyword Management Guide

This guide explains how to add, edit, and manage keyword definitions in the Nora app.

## Overview

Keywords are terms in lesson content that can be tapped to show definitions. They help parents understand important concepts like "Attachment Theory" or "Play Therapy."

## File Structure

```
docs/
├── keywords-new-format.md    # Main keywords file (use this!)
├── keywords-template.md      # Template and style guide
└── KEYWORDS-GUIDE.md         # This file

scripts/
├── sync-keywords.js          # Smart sync (recommended - upserts)
├── import-keywords.js        # Full replacement import
└── add-keywords.js           # Old script (deprecated)
```

## Quick Start

### Adding a New Keyword

1. **Edit the keywords file:**
   ```bash
   code docs/keywords-new-format.md
   ```

2. **Add your keyword using the template:**
   ```markdown
   ### Your Keyword Name

   **History:** Background information (optional)

   **Key Concept:** Main explanation here.

   **The Result:** What this means for parents.
   ```

3. **Sync to database:**
   ```bash
   node scripts/sync-keywords.js docs/keywords-new-format.md
   ```

4. **Restart your server** for changes to take effect.

### Editing an Existing Keyword

1. Open `docs/keywords-new-format.md`
2. Find the keyword (search for `### Keyword Name`)
3. Edit the definition
4. Sync changes: `node scripts/sync-keywords.js docs/keywords-new-format.md`
5. Restart server

### Testing Keywords

After importing, test in the app:

1. Find a lesson that contains your keyword term
2. Open the lesson in the app
3. The keyword should be underlined in purple
4. Tap it to see the definition modal

## Format Rules

### ✅ DO

```markdown
### Attachment Theory

**History:** Developed by John Bowlby in the 1950s.

**Key Concept:** The "Secure Base" provides safety and encourages exploration.
```

**Why:** Clean, consistent, easy to parse

### ❌ DON'T

```markdown
Attachment Theory: Developed by John Bowlby...
```

**Why:** Doesn't use markdown headers, harder to parse

### ✅ DO

```markdown
### Flow

A psychological state of deep immersion. Protecting "flow" builds attention span.
```

**Why:** Simple, direct, no unnecessary structure

### ❌ DON'T

```markdown
### Flow:

Definition: A psychological state...
```

**Why:** Unnecessary colons and labels, inconsistent

## Writing Good Definitions

### Length
- **Ideal:** 1-3 sentences (50-150 words)
- **Maximum:** 2000 characters
- **Too short:** < 20 words (add more context)
- **Too long:** > 300 words (consider splitting)

### Tone
- Write for parents, not academics
- Explain practical benefits
- Avoid jargon or explain it
- Be warm and encouraging

### Structure Options

**Option 1: Simple (for clear concepts)**
```markdown
### Keyword

One clear paragraph explaining the concept.
```

**Option 2: Structured (for complex concepts)**
```markdown
### Keyword

**History:** Background context.

**Key Concept:** Core explanation.

**The Result:** Practical outcome.
```

**Option 3: Scientific (for research-backed terms)**
```markdown
### Keyword

**The Science:** Scientific explanation.

**The Result:** What this means in practice.
```

## Keyword Naming

### ✅ Good Names
- `Attachment Theory` (proper noun, capitalized)
- `Play Therapy` (established term)
- `Flow` (single word concepts)
- `Triple P` (abbreviation with expansion in definition)

### ❌ Avoid
- `ATTACHMENT THEORY` (all caps)
- `attachment theory` (too casual for proper nouns)
- `The Attachment Theory` (unnecessary article)
- `A.T.` (unclear abbreviations without expansion)

## Common Issues

### Issue: Keyword not showing in app
**Solutions:**
1. Check spelling matches exactly (case-insensitive matching)
2. Verify keyword exists in database:
   ```bash
   node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.keyword.findMany().then(k=>console.log(k.map(x=>x.term))).finally(()=>p.\$disconnect())"
   ```
3. Restart server and Metro bundler
4. Clear app cache

### Issue: Definition looks wrong
**Solutions:**
1. Check markdown formatting (no syntax errors)
2. Avoid very long single lines (use line breaks)
3. Test bold formatting: `**text**` not `*text*`

### Issue: Duplicate or overlapping keywords
**Solutions:**
1. Make terms more specific ("Play" vs "Play Therapy")
2. Parser handles longest match first automatically
3. Check for exact duplicates in file

## Database Management

### View all keywords
```bash
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.keyword.findMany({orderBy:{term:'asc'}}).then(k=>{k.forEach((x,i)=>console.log(\`\${i+1}. \${x.term}\`))}).finally(()=>p.\$disconnect())"
```

### Count keywords
```bash
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.keyword.count().then(c=>console.log('Total keywords:',c)).finally(()=>p.\$disconnect())"
```

### Delete all keywords
```bash
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.keyword.deleteMany().then(r=>console.log('Deleted',r.count,'keywords')).finally(()=>p.\$disconnect())"
```

### Export keywords to JSON
```bash
node -e "const {PrismaClient}=require('@prisma/client');const fs=require('fs');const p=new PrismaClient();p.keyword.findMany({orderBy:{term:'asc'}}).then(k=>{fs.writeFileSync('keywords-export.json',JSON.stringify(k,null,2));console.log('Exported',k.length,'keywords')}).finally(()=>p.\$disconnect())"
```

## Scripts

### sync-keywords.js (Recommended)
Smart sync that preserves existing data:
```bash
# Update/add keywords, keep orphans
node scripts/sync-keywords.js docs/keywords-new-format.md

# Update/add keywords, remove orphans not in file
node scripts/sync-keywords.js docs/keywords-new-format.md --remove-orphans
```

**What it does:**
- ✅ Updates existing keywords (preserves ID, createdAt)
- ✅ Adds new keywords
- ✅ Shows preview before applying
- ✅ Safe for production
- ⚠️ With `--remove-orphans`: deletes keywords not in file

### import-keywords.js (Nuclear option)
Full replacement - deletes everything and re-imports:
```bash
node scripts/import-keywords.js docs/keywords-new-format.md
```

**Use when:**
- Initial setup
- Complete restructure
- **Not recommended for production** (loses IDs, timestamps)

## Workflow

### Development
1. Edit `docs/keywords-new-format.md`
2. Sync: `node scripts/sync-keywords.js docs/keywords-new-format.md`
3. Test in app
4. Iterate

### Production
1. Update keywords file in repo
2. Deploy code changes
3. Run sync script on server:
   ```bash
   NODE_ENV=production node scripts/sync-keywords.js docs/keywords-new-format.md
   ```
4. Restart server

## Best Practices

1. **Keep it simple** - Don't over-structure simple concepts
2. **Be consistent** - Use same structure for similar terms
3. **Test regularly** - Check keywords appear correctly in app
4. **Review definitions** - Keep language parent-friendly
5. **Update documentation** - Keep this guide current
6. **Version control** - Commit keywords file with code changes

## Migration from Old Format

If you have keywords in the old format (`docs/keywords`), convert them:

1. Create new file: `docs/keywords-new-format.md`
2. Add header: `# Nora Keyword Definitions`
3. Convert each keyword:
   ```
   Old:
   Keyword Name:
   Definition here.

   New:
   ### Keyword Name

   Definition here.
   ```
4. Import: `node scripts/import-keywords.js docs/keywords-new-format.md`
5. Delete old file after verifying

## Support

**Questions?** Check:
- Template: `docs/keywords-template.md`
- Import errors: Check console output from import script
- App not showing keywords: Verify server has restarted
- Format issues: Follow examples in `keywords-new-format.md`
