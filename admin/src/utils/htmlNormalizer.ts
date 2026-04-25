import LUCIDE_ICON_MAP from './lucideIconMap.generated';

// Alias for use in expandLucideComponents
const LUCIDE_ICONS: Record<string, string> = LUCIDE_ICON_MAP;

function expandLucideComponents(html: string): string {
  // Matches <PascalCaseName ...attrs... /> — self-closing JSX components (name may contain digits, e.g. Mic2, Volume2)
  return html.replace(/<([A-Z][a-zA-Z0-9]+)(\s[^>]*)?\s*\/>/g, (match, name, attrsStr = '') => {
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

    // fill prop (e.g. fill="currentColor" for filled icons like Star)
    const fillMatch = attrsStr.match(/\bfill="([^"]*)"/);
    const fill = fillMatch?.[1] ?? 'none';

    // stroke-width from strokeWidth={N} (already renamed by step 2) or stroke-width="N"
    const swMatch = attrsStr.match(/\bstroke-width=(?:\{?([\d.]+)\}?|"([\d.]+)")/);
    const strokeWidth = swMatch ? (swMatch[1] ?? swMatch[2]) : '2';

    const classAttr = cls ? ` class="${cls}"` : '';
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${classAttr}>${inner}</svg>`;
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
    /^\{\s*(\[[\s\S]*?\])\s*\.map\s*\(\s*\(?\s*(\w+)(?:\s*,\s*(\w+))?\s*\)?\s*=>\s*\(([\s\S]*)\)\s*\)\s*\}$/
  );
  if (!match) return null;
  const [, arrayStr, varName, idxVar, template] = match;
  try {
    // eslint-disable-next-line no-new-func
    const items = new Function(`return ${arrayStr}`)() as unknown[];
    if (!Array.isArray(items)) return null;
    return items
      .map((item, idx) => {
        let t = template;
        // Replace {varName.prop} for object items
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          t = t.replace(new RegExp(`\\{${varName}\\.(\\w+)\\}`, 'g'), (_, prop) =>
            String(obj[prop] ?? '')
          );
        }
        // Replace plain {varName}
        t = t.replace(new RegExp(`\\{${varName}\\}`, 'g'), String(item));
        // Replace index variable
        if (idxVar) t = t.replace(new RegExp(`\\{${idxVar}\\}`, 'g'), String(idx));
        return t.trim();
      })
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

function extractLocalVars(html: string): Record<string, string> {
  const vars: Record<string, string> = {};
  // Match: const name = 'value' | "value" | `value`
  const re = /\bconst\s+(\w+)\s*=\s*(['"`])((?:[^\\]|\\.)*?)\2/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    vars[m[1]] = m[3];
  }
  return vars;
}

export function normalizeHtml(html: string): string {
  let result = html;

  // 0. Extract local const declarations, substitute variable references, then remove the const lines
  const localVars = extractLocalVars(result);
  if (Object.keys(localVars).length > 0) {
    // Remove the const declaration lines from the output
    result = result.replace(/\bconst\s+\w+\s*=\s*(['"`])(?:[^\\]|\\.)*?\1\s*;?\n?/g, '');
    // Resolve identifiers inside style={{ ... }} before JSON-parse step
    result = result.replace(/style=\{\{([^}]*(?:\{[^}]*\}[^}]*)*)\}\}/g, (match, inner) => {
      let sub = inner;
      for (const [name, value] of Object.entries(localVars)) {
        sub = sub.replace(new RegExp(`(?<!['"\\w])${name}(?!['"\\w])`, 'g'), `'${value}'`);
      }
      return `style={{${sub}}}`;
    });
    // Resolve identifiers in other expression attrs: fill={varName}, stroke={varName}, etc.
    result = result.replace(/=\{([a-z][a-zA-Z0-9]*)\}/g, (match, name) =>
      localVars[name] !== undefined ? `="${localVars[name]}"` : match
    );
  }

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
