/**
 * gen-lucide-map.cjs
 * Generates src/utils/lucideIconMap.generated.ts from the installed lucide-react package.
 * Run: node admin/scripts/gen-lucide-map.cjs
 */

const fs = require('fs');
const path = require('path');

const CJS_PATH = path.join(__dirname, '../node_modules/lucide-react/dist/cjs/lucide-react.js');
const OUT_PATH = path.join(__dirname, '../src/utils/lucideIconMap.generated.ts');

const src = fs.readFileSync(CJS_PATH, 'utf8');

// ── Step 1: extract all iconNode variable assignments ────────────────────────
function extractArrayLiterals(code) {
  const map = new Map();
  // Match: const __iconNode$XX = [ (variable names may contain extra $ characters)
  const varRe = /const (__iconNode\$[\w$]+)\s*=\s*\[/g;
  let m;
  while ((m = varRe.exec(code)) !== null) {
    const varName = m[1];
    const start = m.index + m[0].length - 1; // opening [
    let depth = 0, i = start;
    while (i < code.length) {
      if (code[i] === '[') depth++;
      else if (code[i] === ']') { depth--; if (depth === 0) { i++; break; } }
      i++;
    }
    map.set(varName, code.slice(start, i));
  }
  return map;
}

// ── Step 2: extract icon name → varName mappings ─────────────────────────────
function extractIconMappings(code) {
  const result = new Map();
  // Match: const Volume2 = createLucideIcon("volume-2", __iconNode$Y);
  const re = /const ([A-Z][A-Za-z0-9]+)\s*=\s*createLucideIcon\s*\(\s*"[\w-]+"\s*,\s*(__iconNode\$[\w$]+)\s*\)/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    result.set(m[1], m[2]); // PascalName → varName
  }
  return result;
}

// ── Step 3: parse element tuple ["tag", {attrs}] → SVG element string ────────
function parseElement(tuple) {
  const tagMatch = tuple.match(/^\s*\[\s*"([a-z]+)"/);
  if (!tagMatch) return null;
  const tag = tagMatch[1];

  const attrStart = tuple.indexOf('{');
  if (attrStart === -1) return `<${tag}/>`;

  // Find matching }
  let depth = 0, j = attrStart;
  while (j < tuple.length) {
    if (tuple[j] === '{') depth++;
    else if (tuple[j] === '}') { depth--; if (depth === 0) { j++; break; } }
    j++;
  }
  const attrSrc = tuple.slice(attrStart, j);

  const attrRe = /(\w+)\s*:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([\d.]+))/g;
  const attrs = [];
  let am;
  while ((am = attrRe.exec(attrSrc)) !== null) {
    const key = am[1];
    if (key === 'key') continue;
    const val = am[2] ?? am[3] ?? am[4];
    const htmlKey = key.replace(/([A-Z])/g, (c) => `-${c.toLowerCase()}`);
    attrs.push(`${htmlKey}="${val}"`);
  }

  const attrStr = attrs.length ? ' ' + attrs.join(' ') : '';
  return `<${tag}${attrStr}/>`;
}

// ── Step 4: convert array literal string → SVG inner string ──────────────────
function arrayToSvgInner(arrayStr) {
  // Strip the outer [ ] to get the comma-separated child elements
  const inner = arrayStr.slice(arrayStr.indexOf('[') + 1, arrayStr.lastIndexOf(']'));
  // Find each top-level ["tag", {...}] child
  const elements = [];
  let depth = 0, start = -1;
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '[') {
      if (depth === 0) start = i;
      depth++;
    } else if (inner[i] === ']') {
      depth--;
      if (depth === 0 && start !== -1) {
        elements.push(inner.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return elements.map(parseElement).filter(Boolean).join('');
}

// ── Step 5: extract alias exports (e.g. exports.Mic2 = MicVocal) ─────────────
function extractAliases(code) {
  const aliases = new Map(); // alias → canonical
  const re = /exports\.([A-Z][A-Za-z0-9]+)\s*=\s*([A-Z][A-Za-z0-9]+);/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const [, alias, canonical] = m;
    if (alias !== canonical) aliases.set(alias, canonical);
  }
  return aliases;
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log('Parsing lucide-react CJS bundle…');

const iconNodeVars = extractArrayLiterals(src);
console.log(`  iconNode variables: ${iconNodeVars.size}`);

const iconMappings = extractIconMappings(src);
console.log(`  icon components: ${iconMappings.size}`);

const aliases = extractAliases(src);
console.log(`  aliases: ${aliases.size}`);

// Build canonical name → SVG inner map first
const svgMap = new Map(); // PascalName → inner string
for (const [pascalName, varName] of iconMappings) {
  const arrayStr = iconNodeVars.get(varName);
  if (!arrayStr) continue;
  const inner = arrayToSvgInner(arrayStr);
  if (!inner) continue;
  svgMap.set(pascalName, inner);
}

// Resolve aliases to the same SVG
for (const [alias, canonical] of aliases) {
  if (!svgMap.has(alias) && svgMap.has(canonical)) {
    svgMap.set(alias, svgMap.get(canonical));
  }
}

const lines = [
  '// AUTO-GENERATED — do not edit manually.',
  '// Run: node admin/scripts/gen-lucide-map.cjs',
  '',
  'const LUCIDE_ICON_MAP: Record<string, string> = {',
];

let count = 0;
for (const [name, inner] of svgMap) {
  const escaped = inner.replace(/`/g, '\\`');
  lines.push(`  ${name}: \`${escaped}\`,`);
  count++;
}

lines.push('};', '', 'export default LUCIDE_ICON_MAP;', '');

fs.writeFileSync(OUT_PATH, lines.join('\n'), 'utf8');
console.log(`  Generated ${count} icons → ${path.relative(process.cwd(), OUT_PATH)}`);
