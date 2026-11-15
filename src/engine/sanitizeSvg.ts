export class SvgLoadError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'SvgLoadError';
  }
}

const DISALLOWED_SVG_TAGS = new Set([
  'script',
  'foreignobject',
  'iframe',
  'object',
  'embed',
  'audio',
  'video',
  'animate',
  'animatemotion',
  'animatetransform',
  'set',
  'handler',
  'listener',
  'meta',
  'link',
  'base',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'html',
  'body',
  'head',
]);

const ALLOWED_SVG_TAGS = new Set([
  'svg',
  'g',
  'defs',
  'title',
  'desc',
  'metadata',
  'style',
  'text',
  'tspan',
  'textpath',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polygon',
  'polyline',
  'path',
  'image',
  'use',
  'symbol',
  'clippath',
  'mask',
  'pattern',
  'marker',
  'lineargradient',
  'radialgradient',
  'stop',
  'filter',
  'feblend',
  'fecolormatrix',
  'fecomponenttransfer',
  'fecomposite',
  'feconvolvematrix',
  'fediffuselighting',
  'fedisplacementmap',
  'fedistantlight',
  'fedropshadow',
  'feflood',
  'fefunca',
  'fefuncb',
  'fefuncg',
  'fefuncr',
  'fegaussianblur',
  'feimage',
  'femerge',
  'femergenode',
  'femorphology',
  'feoffset',
  'fepointlight',
  'fespecularlighting',
  'fespotlight',
  'fetile',
  'feturbulence',
  'a',
  'switch',
  'view',
  'solidcolor',
  'hatch',
  'hatchpath',
]);

const SAFE_RASTER_DATA_URI_RE = /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i;
const INTERNAL_REF_RE = /^#[a-zA-Z0-9_.:-]+$/;

const URL_PRESENTATION_ATTRS = new Set([
  'fill',
  'stroke',
  'clip-path',
  'mask',
  'mask-image',
  'filter',
  'marker-start',
  'marker-mid',
  'marker-end',
  'cursor',
  'clip',
]);

export interface SanitizeSvgResult {
  rootElement: SVGSVGElement;
  viewBox: string;
  securityFindings: string[];
}

function decodeCssEscapes(input: string): string {
  return input.replace(/\\([0-9a-fA-F]{1,6})\s?|\\([^\r\n\f])/g, (_, hex: string, ch: string) => {
    if (hex) {
      const code = parseInt(hex, 16);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return '';
        }
      }
      return '';
    }
    return ch || '';
  });
}

function normalizeForUriSchemeCheck(raw: string): string[] {
  const candidates: string[] = [];
  const stripControlAndSpace = (s: string) =>
    s.replace(/[\u0000-\u0020\u007f-\u009f\s]+/g, '').toLowerCase();

  candidates.push(stripControlAndSpace(raw));

  const cssDecoded = decodeCssEscapes(raw);
  if (cssDecoded !== raw) {
    candidates.push(stripControlAndSpace(cssDecoded));
  }

  try {
    const pctDecoded = decodeURIComponent(raw);
    if (pctDecoded !== raw) {
      candidates.push(stripControlAndSpace(pctDecoded));
    }
  } catch {
    // Malformed percent encoding — also check manual %XX hex decoding for scheme probes
    const partial = raw.replace(/%([0-9a-fA-F]{2})/g, (_, h: string) =>
      String.fromCharCode(parseInt(h, 16))
    );
    candidates.push(stripControlAndSpace(partial));
  }

  return candidates;
}

export function hasUnsafeUriScheme(raw: string): boolean {
  if (!raw) return false;
  const candidates = normalizeForUriSchemeCheck(raw);
  return candidates.some(
    (c) =>
      /(?:javascript|vbscript):/i.test(c) ||
      /data:(?:text\/html|image\/svg\+xml|application\/xhtml\+xml)/i.test(c)
  );
}

function isExternalUrlFunction(urlArg: string): boolean {
  const cleaned = decodeCssEscapes(urlArg)
    .replace(/[\u0000-\u0020\u007f]+/g, '')
    .replace(/^['"]|['"]$/g, '')
    .trim();
  if (!cleaned) return false;
  if (INTERNAL_REF_RE.test(cleaned)) return false;
  if (SAFE_RASTER_DATA_URI_RE.test(cleaned)) return false;
  return true;
}

function replaceExternalCssUrls(cssText: string, findings: string[], sourceLabel: string): string {
  return cssText.replace(/url\s*\(([^)]*)\)/gi, (fullMatch, inner: string) => {
    if (hasUnsafeUriScheme(inner) || isExternalUrlFunction(inner)) {
      findings.push(`Removed external or unsafe url() reference from ${sourceLabel}.`);
      return 'none';
    }
    return fullMatch;
  });
}

function sanitizeStyleText(cssText: string, findings: string[]): string {
  // Strip CSS comments first so obfuscated @import / javascript: / url() cannot hide across /* */
  let next = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const decodedProbe = decodeCssEscapes(next);

  if (/@import\b/i.test(next) || /@import\b/i.test(decodedProbe)) {
    findings.push('Removed external CSS @import directive from <style>.');
    next = decodeCssEscapes(next).replace(/@import\s+(?:url\s*\([^)]*\)|[^;\n])+;?/gi, '');
  }

  if (hasUnsafeUriScheme(next)) {
    findings.push('Removed unsafe URI scheme from <style>.');
    next = decodeCssEscapes(next).replace(
      /(?:javascript|vbscript|data\s*:\s*(?:text\/html|image\/svg\+xml|application\/xhtml\+xml))[^;\n)}"]*/gi,
      'none'
    );
  }

  if (/expression\s*\(|-moz-binding|behavior\s*:/i.test(next) || /expression\s*\(|-moz-binding|behavior\s*:/i.test(decodedProbe)) {
    findings.push('Removed unsafe CSS expression or binding from <style>.');
    next = decodeCssEscapes(next)
      .replace(/expression\s*\([^)]*\)/gi, 'none')
      .replace(/-moz-binding\s*:[^;\n}]+;?/gi, '')
      .replace(/behavior\s*:[^;\n}]+;?/gi, '');
  }

  next = replaceExternalCssUrls(next, findings, '<style>');
  return next;
}

export function sanitizeSvgDocument(rawSvg: string): SanitizeSvgResult {
  if (!rawSvg || !rawSvg.trim()) {
    console.error('[Invotora][Security] SVG sanitization failed: empty input.');
    throw new SvgLoadError('SVG_LOAD_ERROR', 'The SVG file is empty.');
  }

  // Strip XML processing instructions such as <?xml-stylesheet ... ?> before parsing
  const strippedRaw = rawSvg.replace(/<\?xml-stylesheet[\s\S]*?\?>/gi, '');

  const parser = new DOMParser();
  const doc = parser.parseFromString(strippedRaw, 'image/svg+xml');
  if (doc.querySelector('parsererror')) {
    console.error('[Invotora][Security] SVG XML parsererror encountered.');
    throw new SvgLoadError(
      'SVG_LOAD_ERROR',
      'The SVG file contains invalid XML syntax and could not be parsed.'
    );
  }

  const svgRoot = doc.documentElement;
  if (!svgRoot || svgRoot.tagName.toLowerCase() !== 'svg') {
    console.error('[Invotora][Security] Root element is not <svg>.');
    throw new SvgLoadError(
      'SVG_LOAD_ERROR',
      'The file does not contain a valid <svg> root element.'
    );
  }

  const securityFindings: string[] = [];

  const sanitizeAttributes = (el: Element, tag: string) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const val = attr.value.trim();

      if (name.startsWith('on')) {
        securityFindings.push(`Removed inline event handler attribute "${attr.name}".`);
        el.removeAttribute(attr.name);
        continue;
      }

      if (name === 'href' || name === 'xlink:href') {
        const isInternal = INTERNAL_REF_RE.test(val) && !hasUnsafeUriScheme(val);
        const isSafeEmbeddedPhoto = tag === 'image' && SAFE_RASTER_DATA_URI_RE.test(val);
        if (!isInternal && !isSafeEmbeddedPhoto) {
          securityFindings.push(
            `Removed external or unsafe ${attr.name} reference on <${tag}> ("${val.slice(0, 60)}").`
          );
          el.removeAttribute(attr.name);
        }
        continue;
      }

      if (
        (name === 'src' || name === 'data' || name === 'formaction' || name === 'action') &&
        val.length > 0
      ) {
        securityFindings.push(`Removed unsafe ${attr.name} attribute.`);
        el.removeAttribute(attr.name);
        continue;
      }

      if (hasUnsafeUriScheme(val)) {
        securityFindings.push(`Removed unsafe URI in attribute "${attr.name}".`);
        el.removeAttribute(attr.name);
        continue;
      }

      if (name === 'style') {
        const cleanedStyle = val.replace(/\/\*[\s\S]*?\*\//g, '');
        const decodedStyle = decodeCssEscapes(cleanedStyle);
        if (
          hasUnsafeUriScheme(cleanedStyle) ||
          /@import\b/i.test(decodedStyle) ||
          /expression\s*\(|-moz-binding|behavior\s*:/i.test(decodedStyle)
        ) {
          securityFindings.push('Removed unsafe inline style declaration.');
          el.removeAttribute(attr.name);
        } else if (/url\s*\(/i.test(cleanedStyle)) {
          const nextStyle = replaceExternalCssUrls(cleanedStyle, securityFindings, 'inline style');
          el.setAttribute(attr.name, nextStyle);
        }
      } else if (URL_PRESENTATION_ATTRS.has(name) && /url\s*\(/i.test(val)) {
        const nextVal = replaceExternalCssUrls(val, securityFindings, `"${attr.name}"`);
        if (nextVal !== val) {
          if (nextVal === 'none') {
            el.removeAttribute(attr.name);
          } else {
            el.setAttribute(attr.name, nextVal);
          }
        }
      }
    }
  };

  sanitizeAttributes(svgRoot, 'svg');

  const walkAndClean = (node: Element) => {
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toLowerCase();
      if (DISALLOWED_SVG_TAGS.has(tag) || !ALLOWED_SVG_TAGS.has(tag)) {
        securityFindings.push(`Removed disallowed <${tag}> element.`);
        child.remove();
        continue;
      }

      if (tag === 'style' && child.textContent) {
        child.textContent = sanitizeStyleText(child.textContent, securityFindings);
      }

      sanitizeAttributes(child, tag);
      walkAndClean(child);
    }
  };

  walkAndClean(svgRoot);

  if (securityFindings.length > 0) {
    console.warn(
      `[Invotora][Security] Sanitized ${securityFindings.length} unsafe item(s) in SVG:`,
      securityFindings
    );
  }

  const viewBox = svgRoot.getAttribute('viewBox') || '0 0 1500 2100';

  return {
    rootElement: svgRoot as unknown as SVGSVGElement,
    viewBox,
    securityFindings,
  };
}
