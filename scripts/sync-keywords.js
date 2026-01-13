/**
 * Sync keywords from markdown file to database (smart upsert)
 *
 * This script:
 * - Updates existing keywords (preserves ID and createdAt)
 * - Adds new keywords
 * - Optionally removes keywords not in file
 *
 * Usage: node scripts/sync-keywords.js [path-to-keywords-file] [--remove-orphans]
 * Example: node scripts/sync-keywords.js docs/keywords-new-format.md
 * Example: node scripts/sync-keywords.js docs/keywords-new-format.md --remove-orphans
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

/**
 * Parse keywords from markdown format
 * Expected format: ### Keyword Term followed by definition text
 */
function parseMarkdownKeywords(content) {
  const keywords = [];
  const lines = content.split('\n');

  let currentKeyword = null;
  let currentDefinition = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this is a keyword header (### Keyword Name)
    if (line.startsWith('### ')) {
      // Save previous keyword if exists
      if (currentKeyword) {
        keywords.push({
          term: currentKeyword,
          definition: currentDefinition.join('\n').trim()
        });
      }

      // Start new keyword
      currentKeyword = line.substring(4).trim(); // Remove "### "
      currentDefinition = [];
    }
    // Skip horizontal rules and empty lines at the start
    else if (line.trim() === '---' || line.trim() === '' && !currentKeyword) {
      continue;
    }
    // Skip the main heading
    else if (line.startsWith('# ')) {
      continue;
    }
    // Add to definition if we have a current keyword
    else if (currentKeyword !== null) {
      currentDefinition.push(line);
    }
  }

  // Don't forget the last keyword
  if (currentKeyword) {
    keywords.push({
      term: currentKeyword,
      definition: currentDefinition.join('\n').trim()
    });
  }

  return keywords;
}

/**
 * Validate keyword data
 */
function validateKeyword(keyword, index) {
  const errors = [];

  if (!keyword.term || keyword.term.trim().length === 0) {
    errors.push(`Keyword ${index + 1}: Missing term`);
  }

  if (!keyword.definition || keyword.definition.trim().length === 0) {
    errors.push(`Keyword ${index + 1} (${keyword.term}): Missing definition`);
  }

  if (keyword.definition && keyword.definition.length > 2000) {
    errors.push(`Keyword ${index + 1} (${keyword.term}): Definition too long (${keyword.definition.length} chars, max 2000)`);
  }

  return errors;
}

async function syncKeywords(filePath, removeOrphans = false) {
  try {
    // Read the keywords file
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);

    console.log(`📖 Reading keywords from: ${fullPath}`);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');

    // Parse keywords
    console.log('🔍 Parsing keywords...');
    const fileKeywords = parseMarkdownKeywords(content);
    console.log(`✅ Parsed ${fileKeywords.length} keywords from file\n`);

    // Validate all keywords
    let allErrors = [];
    fileKeywords.forEach((keyword, index) => {
      const errors = validateKeyword(keyword, index);
      allErrors = allErrors.concat(errors);
    });

    if (allErrors.length > 0) {
      console.error('❌ Validation errors found:');
      allErrors.forEach(err => console.error(`  - ${err}`));
      throw new Error('Validation failed');
    }

    // Fetch existing keywords from database
    const existingKeywords = await prisma.keyword.findMany();
    const existingByTerm = new Map(existingKeywords.map(k => [k.term, k]));

    console.log(`📊 Current database state: ${existingKeywords.length} keywords\n`);

    // Categorize changes
    const toUpdate = [];
    const toCreate = [];
    const fileTerms = new Set(fileKeywords.map(k => k.term));

    for (const fileKeyword of fileKeywords) {
      const existing = existingByTerm.get(fileKeyword.term);

      if (existing) {
        // Check if definition changed
        if (existing.definition !== fileKeyword.definition) {
          toUpdate.push({
            ...fileKeyword,
            id: existing.id,
            oldDefinition: existing.definition
          });
        }
      } else {
        toCreate.push(fileKeyword);
      }
    }

    // Find orphaned keywords (in DB but not in file)
    const toDelete = removeOrphans
      ? existingKeywords.filter(k => !fileTerms.has(k.term))
      : [];

    // Preview changes
    console.log('📋 Changes to apply:\n');

    if (toCreate.length > 0) {
      console.log(`✨ CREATE (${toCreate.length} new):`);
      toCreate.forEach(k => {
        const preview = k.definition.substring(0, 60).replace(/\n/g, ' ');
        console.log(`  + ${k.term}`);
        console.log(`    "${preview}${k.definition.length > 60 ? '...' : ''}"`);
      });
      console.log();
    }

    if (toUpdate.length > 0) {
      console.log(`📝 UPDATE (${toUpdate.length} changed):`);
      toUpdate.forEach(k => {
        console.log(`  ~ ${k.term}`);
        console.log(`    Old: "${k.oldDefinition.substring(0, 50)}..."`);
        console.log(`    New: "${k.definition.substring(0, 50)}..."`);
      });
      console.log();
    }

    if (toDelete.length > 0) {
      console.log(`🗑️  DELETE (${toDelete.length} orphaned):`);
      toDelete.forEach(k => {
        console.log(`  - ${k.term}`);
      });
      console.log();
    }

    if (toCreate.length === 0 && toUpdate.length === 0 && toDelete.length === 0) {
      console.log('✅ No changes needed - database is already in sync!\n');
      return;
    }

    console.log(`⚠️  About to apply changes...`);
    console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Apply changes
    let createCount = 0;
    let updateCount = 0;
    let deleteCount = 0;

    // Create new keywords
    if (toCreate.length > 0) {
      for (const keyword of toCreate) {
        await prisma.keyword.create({
          data: {
            id: crypto.randomUUID(),
            term: keyword.term,
            definition: keyword.definition
          }
        });
        createCount++;
        console.log(`✅ Created: ${keyword.term}`);
      }
    }

    // Update existing keywords
    if (toUpdate.length > 0) {
      for (const keyword of toUpdate) {
        await prisma.keyword.update({
          where: { id: keyword.id },
          data: {
            definition: keyword.definition,
            updatedAt: new Date()
          }
        });
        updateCount++;
        console.log(`✅ Updated: ${keyword.term}`);
      }
    }

    // Delete orphaned keywords
    if (toDelete.length > 0) {
      for (const keyword of toDelete) {
        await prisma.keyword.delete({
          where: { id: keyword.id }
        });
        deleteCount++;
        console.log(`✅ Deleted: ${keyword.term}`);
      }
    }

    console.log();
    console.log('━'.repeat(60));
    console.log(`✨ Sync complete!`);
    console.log(`   Created: ${createCount}`);
    console.log(`   Updated: ${updateCount}`);
    console.log(`   Deleted: ${deleteCount}`);
    console.log('━'.repeat(60));

    // Final verification
    const finalCount = await prisma.keyword.count();
    console.log(`\n📚 Total keywords in database: ${finalCount}\n`);

    // List all keywords
    const allKeywords = await prisma.keyword.findMany({
      orderBy: { term: 'asc' }
    });

    console.log('Current keywords:');
    allKeywords.forEach((k, i) => {
      console.log(`  ${i + 1}. ${k.term}`);
    });

  } catch (error) {
    console.error('\n❌ Error syncing keywords:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const filePath = args.find(arg => !arg.startsWith('--')) || 'docs/keywords-new-format.md';
const removeOrphans = args.includes('--remove-orphans');

if (removeOrphans) {
  console.log('⚠️  Running in REMOVE ORPHANS mode - keywords not in file will be deleted\n');
}

syncKeywords(filePath, removeOrphans);
