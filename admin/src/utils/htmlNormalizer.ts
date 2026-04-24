// Lucide icon name → SVG inner content (paths/circles/lines).
// Add entries here as new icons appear in pasted JSX.
const LUCIDE_ICONS: Record<string, string> = {
  XCircle:      `<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>`,
  ShieldCheck:  `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>`,
  CheckCircle:  `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`,
  Check:        `<polyline points="20 6 9 17 4 12"/>`,
  X:            `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`,
  AlertCircle:  `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`,
  Info:         `<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>`,
  Star:         `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
  Heart:        `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>`,
  Lock:         `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
  Unlock:       `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>`,
  ChevronRight: `<polyline points="9 18 15 12 9 6"/>`,
  ChevronLeft:  `<polyline points="15 18 9 12 15 6"/>`,
  ArrowRight:   `<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>`,
  ArrowLeft:    `<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>`,
  Plus:         `<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`,
  Minus:        `<line x1="5" y1="12" x2="19" y2="12"/>`,
  Smile:        `<circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>`,
  Frown:        `<circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>`,
  Lightbulb:    `<line x1="9" y1="21" x2="15" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17H8v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/>`,
  BookOpen:     `<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>`,
  Target:       `<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>`,
  Zap:          `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
  Trophy:       `<polyline points="8 21 12 17 16 21"/><line x1="12" y1="17" x2="12" y2="11"/><path d="M5 6H3a2 2 0 0 0-2 2v1a4 4 0 0 0 4 4h0"/><path d="M19 6h2a2 2 0 0 1 2 2v1a4 4 0 0 1-4 4h0"/><rect x="5" y="2" width="14" height="8" rx="1"/>`,
  Quote:        `<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 2v7c0 1.25.756 2.017 2 2h1c1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 2v7c0 1.25.755 2.017 2 2h1c1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>`,
  MessageCircle:`<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
  Sparkles:     `<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M5 3l.75 2.25L8 6l-2.25.75L5 9l-.75-2.25L2 6l2.25-.75z"/><path d="M19 13l.75 2.25L22 16l-2.25.75L19 19l-.75-2.25L16 16l2.25-.75z"/>`,
  Bird:         `<path d="M16 7h.01"/><path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20"/><path d="m20 7 2 .5-2 .5"/><path d="M10 18v3"/><path d="M14 17.75V21"/><path d="M7 18a6 6 0 0 0 3.84-10.61"/>`,
  Flame:        `<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>`,
  Waves:        `<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>`,
  Brain:        `<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/>`,
};

function expandLucideComponents(html: string): string {
  // Matches <PascalCaseName ...attrs... /> — self-closing JSX components
  return html.replace(/<([A-Z][a-zA-Z]+)(\s[^>]*)?\s*\/>/g, (match, name, attrsStr = '') => {
    const inner = LUCIDE_ICONS[name];
    if (!inner) return match; // unknown — leave for downstream stripping

    // size={N} or size="N"
    const sizeMatch = attrsStr.match(/\bsize=\{?(\d+)\}?/);
    const size = sizeMatch ? sizeMatch[1] : '24';

    // class="..." (className already converted to class in step 2)
    const classMatch = attrsStr.match(/\bclass(?:Name)?="([^"]*)"/);
    const cls = classMatch ? classMatch[1] : '';

    // explicit stroke or color prop
    const strokeMatch = attrsStr.match(/\bstroke="([^"]*)"/);
    const colorMatch  = attrsStr.match(/\bcolor="([^"]*)"/);
    const stroke = strokeMatch?.[1] ?? colorMatch?.[1] ?? 'currentColor';

    const classAttr = cls ? ` class="${cls}"` : '';
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${classAttr}>${inner}</svg>`;
  });
}

const JSX_ATTR_MAP: Record<string, string> = {
  className: 'class',
  strokeWidth: 'stroke-width',
  strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin',
  strokeDasharray: 'stroke-dasharray',
  strokeDashoffset: 'stroke-dashoffset',
  strokeOpacity: 'stroke-opacity',
  stopColor: 'stop-color',
  stopOpacity: 'stop-opacity',
  fillOpacity: 'fill-opacity',
  fillRule: 'fill-rule',
  clipPath: 'clip-path',
  clipRule: 'clip-rule',
  fontFamily: 'font-family',
  fontSize: 'font-size',
  fontWeight: 'font-weight',
  fontStyle: 'font-style',
  textAnchor: 'text-anchor',
  dominantBaseline: 'dominant-baseline',
  htmlFor: 'for',
};

const NON_VOID_TAGS = [
  'div','span','section','article','p','a','button','label',
  'h1','h2','h3','h4','h5','h6','ul','ol','li',
  'header','footer','main','nav','aside','form',
  'table','thead','tbody','tr','td','th',
  'blockquote','pre','code','strong','em','i','b','s',
  'figure','figcaption','details','summary',
];

function jsxStyleObjectToString(obj: string): string {
  try {
    const cleaned = obj.replace(/(\w+):/g, '"$1":').replace(/'/g, '"');
    const parsed = JSON.parse(cleaned);
    return Object.entries(parsed)
      .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`)
      .join(';');
  } catch {
    return '';
  }
}

// Try to expand a single {[...].map((var) => (template))} block into static HTML.
// Returns null if it doesn't match the pattern or evaluation fails.
function tryExpandMapBlock(block: string): string | null {
  const match = block.match(
    /^\{\s*(\[[\s\S]*?\])\s*\.map\s*\(\s*\(?\s*(\w+)(?:\s*,\s*\w+)?\s*\)?\s*=>\s*\(([\s\S]*)\)\s*\)\s*\}$/
  );
  if (!match) return null;
  const [, arrayStr, varName, template] = match;
  try {
    // eslint-disable-next-line no-new-func
    const items = new Function(`return ${arrayStr}`)() as unknown[];
    if (!Array.isArray(items)) return null;
    return items
      .map((item) =>
        template
          .replace(new RegExp(`\\{${varName}\\}`, 'g'), String(item))
          .trim()
      )
      .join('\n');
  } catch {
    return null;
  }
}

// Walk through the string tracking balanced braces.
// When a {[...].map(...)} block is found, expand it; otherwise leave it for stripBalancedBraces.
function expandMapCalls(html: string): string {
  let result = '';
  let i = 0;
  while (i < html.length) {
    if (html[i] === '{') {
      // Find matching closing brace
      let depth = 0;
      let j = i;
      while (j < html.length) {
        if (html[j] === '{') depth++;
        else if (html[j] === '}') { depth--; if (depth === 0) { j++; break; } }
        j++;
      }
      const block = html.slice(i, j);
      if (block.includes('.map(')) {
        const expanded = tryExpandMapBlock(block);
        if (expanded !== null) {
          result += expanded;
          i = j;
          continue;
        }
      }
    }
    result += html[i];
    i++;
  }
  return result;
}

function stripBalancedBraces(str: string): string {
  let result = '';
  let depth = 0;
  let inBrace = false;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '{') {
      if (depth === 0) inBrace = true;
      depth++;
    } else if (str[i] === '}') {
      depth--;
      if (depth === 0 && inBrace) {
        result += '<!-- JSX expression removed - expand manually -->';
        inBrace = false;
      }
    } else if (depth === 0) {
      result += str[i];
    }
  }
  return result;
}

function convertOpacityShorthands(html: string): string {
  const RULES: Array<{ pattern: RegExp; prop: string }> = [
    { pattern: /\bbg-white\/([\d.]+)\b/g,     prop: 'background' },
    { pattern: /\bbg-black\/([\d.]+)\b/g,     prop: 'background' },
    { pattern: /\bborder-white\/([\d.]+)\b/g, prop: 'border-color' },
    { pattern: /\bborder-black\/([\d.]+)\b/g, prop: 'border-color' },
    { pattern: /\btext-white\/([\d.]+)\b/g,   prop: 'color' },
    { pattern: /\btext-black\/([\d.]+)\b/g,   prop: 'color' },
  ];
  const COLORS: Record<string, string> = { white: '255,255,255', black: '0,0,0' };

  return html.replace(/<(\w[\w-]*)([^>]*)>/gi, (match, tag, attrsStr: string) => {
    const classMatch = attrsStr.match(/(\s+class=")([^"]*)(")/);
    if (!classMatch) return match;

    let classes = classMatch[2];
    const newStyles: string[] = [];

    for (const { pattern, prop } of RULES) {
      classes = classes.replace(pattern, (_, opacity) => {
        const colorName = pattern.source.includes('white') ? 'white' : 'black';
        const alpha = Number(opacity) / 100;
        newStyles.push(`${prop}:rgba(${COLORS[colorName]},${alpha})`);
        return '';
      });
    }

    if (newStyles.length === 0) return match;

    let newAttrs = attrsStr.replace(/(\s+class=")([^"]*)(")/,
      `$1${classes.replace(/\s+/g, ' ').trim()}$3`);

    const styleMatch = newAttrs.match(/(\s+style=")([^"]*)(")/);
    if (styleMatch) {
      newAttrs = newAttrs.replace(/(\s+style=")([^"]*)(")/, `$1$2;${newStyles.join(';')}$3`);
    } else {
      newAttrs += ` style="${newStyles.join(';')}"`;
    }

    return `<${tag}${newAttrs}>`;
  });
}

export function normalizeHtml(html: string): string {
  let result = html;

  // 1. style={{ ... }} → style="..."
  result = result.replace(/style=\{\{([^}]*)\}\}/g, (_, inner) => {
    return `style="${jsxStyleObjectToString(`{${inner}}`).replace(/"/g, "'")}"`;
  });

  // 2. JSX prop names → HTML attribute names
  result = Object.entries(JSX_ATTR_MAP).reduce(
    (s, [jsx, attr]) => s.replace(new RegExp(`\\b${jsx}=`, 'g'), `${attr}=`),
    result
  );

  // 3. Remove JSX-only props
  result = result.replace(/\s+key=\{[^}]*\}/g, '');
  result = result.replace(/\s+ref=\{[^}]*\}/g, '');
  result = result.replace(/\s+on[A-Z][a-zA-Z]*=\{[^}]*\}/g, '');

  // 3b. Replace Lucide React components with inline SVGs
  result = expandLucideComponents(result);

  // 4. Fix self-closing non-void tags
  const nonVoidPattern = NON_VOID_TAGS.join('|');
  result = result.replace(
    new RegExp(`<(${nonVoidPattern})(\\s[^>]*)?\/>`, 'gi'),
    (_, tag, attrs = '') => `<${tag}${attrs}></${tag}>`
  );

  // 5. JSX comments → HTML comments
  result = result.replace(/\{\/\*([\s\S]*?)\*\/\}/g, '<!-- $1 -->');

  // 6. Expand {[...].map((var) => (template))} into static HTML
  result = expandMapCalls(result);

  // 7. Strip any remaining { ... } JSX expressions
  result = stripBalancedBraces(result);

  // 8. Convert Tailwind opacity shorthands to inline styles
  result = convertOpacityShorthands(result);

  // 9. Add explicit width/height to SVGs with w-full/h-full classes
  result = result.replace(/<svg(\s[^>]*)?>/gi, (match, attrs = '') => {
    const hasWFull = /\bw-full\b/.test(attrs);
    const hasHFull = /\bh-full\b/.test(attrs);
    if (hasWFull && hasHFull) return `<svg${attrs} width="100%" height="100%">`;
    if (hasWFull && !/ width=/.test(attrs)) return `<svg${attrs} width="100%">`;
    return match;
  });

  return result;
}
