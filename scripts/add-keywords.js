/**
 * Script to add keywords from docs/keywords file to database
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function addKeywords() {
  try {
    // Read the keywords file
    const keywordsPath = path.join(__dirname, '../docs/keywords');
    const content = fs.readFileSync(keywordsPath, 'utf-8');

    // Parse the file
    const lines = content.split('\n');
    const keywords = [];
    let currentKeyword = null;
    let currentDefinition = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line) continue;

      // Check if this is a definition line (starts with known prefixes)
      const isDefinitionLine = line.startsWith('History:') ||
        line.startsWith('Key Concept:') ||
        line.startsWith('The Science:') ||
        line.startsWith('The Result:') ||
        line.startsWith('The Concept:');

      // Check if this is a single-line keyword (contains ':' but not at the end)
      const colonIndex = line.indexOf(':');
      const isSingleLineKeyword = colonIndex > 0 && colonIndex < line.length - 1 && !isDefinitionLine;

      // Check if this is a multi-line keyword header (ends with ':')
      const isMultiLineKeywordHeader = line.endsWith(':') && !isDefinitionLine;

      if (isSingleLineKeyword) {
        // Save previous keyword if exists
        if (currentKeyword) {
          keywords.push({
            term: currentKeyword,
            definition: currentDefinition.join('\n\n').trim()
          });
        }

        // Single line keyword - split at first colon
        currentKeyword = line.substring(0, colonIndex).trim();
        currentDefinition = [line.substring(colonIndex + 1).trim()];
      } else if (isMultiLineKeywordHeader) {
        // Save previous keyword if exists
        if (currentKeyword) {
          keywords.push({
            term: currentKeyword,
            definition: currentDefinition.join('\n\n').trim()
          });
        }

        // Multi-line keyword - definition comes on next lines
        currentKeyword = line.slice(0, -1).trim();
        currentDefinition = [];
      } else if (line && currentKeyword) {
        // Add to current definition
        currentDefinition.push(line);
      }
    }

    // Don't forget the last keyword
    if (currentKeyword) {
      keywords.push({
        term: currentKeyword,
        definition: currentDefinition.join('\n\n').trim()
      });
    }

    console.log(`Parsed ${keywords.length} keywords from file`);

    // Add to database
    const data = keywords.map(k => ({
      id: crypto.randomUUID(),
      term: k.term,
      definition: k.definition
    }));

    const result = await prisma.keyword.createMany({
      data,
      skipDuplicates: true
    });

    console.log(`Added ${result.count} keywords to database`);

    // List all keywords
    const all = await prisma.keyword.findMany({
      orderBy: { term: 'asc' }
    });

    console.log('\nKeywords in database:');
    all.forEach((k, i) => {
      console.log(`${i + 1}. ${k.term}`);
    });

  } catch (error) {
    console.error('Error adding keywords:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addKeywords();
