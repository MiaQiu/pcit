/**
 * Import keywords from markdown format into database
 *
 * Usage: node scripts/import-keywords.js [path-to-keywords-file]
 * Example: node scripts/import-keywords.js docs/keywords-new-format.md
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

async function importKeywords(filePath) {
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
    const keywords = parseMarkdownKeywords(content);
    console.log(`✅ Parsed ${keywords.length} keywords\n`);

    // Validate all keywords
    let allErrors = [];
    keywords.forEach((keyword, index) => {
      const errors = validateKeyword(keyword, index);
      allErrors = allErrors.concat(errors);
    });

    if (allErrors.length > 0) {
      console.error('❌ Validation errors found:');
      allErrors.forEach(err => console.error(`  - ${err}`));
      throw new Error('Validation failed');
    }

    // Preview keywords
    console.log('📋 Keywords to import:');
    keywords.forEach((k, i) => {
      const preview = k.definition.substring(0, 60).replace(/\n/g, ' ');
      console.log(`  ${i + 1}. ${k.term}`);
      console.log(`     "${preview}${k.definition.length > 60 ? '...' : ''}"`);
    });

    console.log('\n⚠️  This will replace ALL existing keywords in the database.');
    console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Delete existing keywords
    const deleteResult = await prisma.keyword.deleteMany();
    console.log(`🗑️  Deleted ${deleteResult.count} existing keywords`);

    // Insert new keywords
    const data = keywords.map(k => ({
      id: crypto.randomUUID(),
      term: k.term,
      definition: k.definition
    }));

    const createResult = await prisma.keyword.createMany({
      data,
      skipDuplicates: false
    });

    console.log(`✅ Added ${createResult.count} new keywords\n`);

    // Verify and list all keywords
    const all = await prisma.keyword.findMany({
      orderBy: { term: 'asc' }
    });

    console.log('📚 Final keyword list in database:');
    all.forEach((k, i) => {
      console.log(`  ${i + 1}. ${k.term}`);
    });

    console.log(`\n✨ Import complete! Total keywords: ${all.length}`);

  } catch (error) {
    console.error('\n❌ Error importing keywords:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get file path from command line arguments or use default
const filePath = process.argv[2] || 'docs/keywords-new-format.md';

importKeywords(filePath);
