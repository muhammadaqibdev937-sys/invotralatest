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
  'svg',
  'view',
  'solidcolor',
  'hatch',
  'hatchpath',
]);

const SAFE_RASTER_DATA_URI_RE = /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i;

export interface SanitizeSvgResult {
  rootElement: SVGSVGElement;
  viewBox: string;
  securityFindings: string[];
}

function sanitizeStyleText(cssText: string, findings: string[]): string {
  let next = cssText;
  if (/@import\b/i.test(next)) {
    findings.push('Removed external CSS @import directive from <style>.');
    next = next.replace(/@import\s+[^;\n]+;?/gi, '');
  }
  if (/javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|data\s*:\s*image\/svg\+xml/i.test(next)) {
    findings.push('Removed unsafe URI scheme from <style>.');
    next = next.replace(
      /(?:javascript|vbscript|data\s*:\s*text\/html|data\s*:\s*image\/svg\+xml)[^;\n)]*/gi,
      'none'
    );
  }
  if (/expression\s*\(|-moz-binding|behavior\s*:/i.test(next)) {
    findings.push('Removed unsafe CSS expression or binding from <style>.');
    next = next
      .replace(/expression\s*\([^)]*\)/gi, 'none')
      .replace(/-moz-binding\s*:[^;\n}]+;?/gi, '')
      .replace(/behavior\s*:[^;\n}]+;?/gi, '');
  }
  if (/url\s*\(\s*['"]?(?!#)[^)'"]+['"]?\s*\)/i.test(next)) {
    findings.push('Removed external url() reference from <style>.');
    next = next.replace(/url\s*\(\s*['"]?(?!#)[^)'"]+['"]?\s*\)/gi, 'none');
  }
  return next;
}

export function sanitizeSvgDocument(rawSvg: string): SanitizeSvgResult {
  if (!rawSvg || !rawSvg.trim()) {
    throw new SvgLoadError('SVG_LOAD_ERROR', 'The SVG file is empty.');
  }

  // Strip XML processing instructions such as <?xml-stylesheet ... ?> before parsing
  const strippedRaw = rawSvg.replace(/<\?xml-stylesheet[\s\S]*?\?>/gi, '');

  const parser = new DOMParser();
  const doc = parser.parseFromString(strippedRaw, 'image/svg+xml');
  if (doc.querySelector('parsererror')) {
    throw new SvgLoadError(
      'SVG_LOAD_ERROR',
      'The SVG file contains invalid XML syntax and could not be parsed.'
    );
  }

  const svgRoot = doc.documentElement;
  if (!svgRoot || svgRoot.tagName.toLowerCase() !== 'svg') {
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
        const isInternal = /^#[a-zA-Z0-9_.:-]+$/.test(val);
        const isSafeEmbeddedPhoto = tag === 'image' && SAFE_RASTER_DATA_URI_RE.test(val);
        if (!isInternal && !isSafeEmbeddedPhoto) {
          securityFindings.push(
            `Removed external or unsafe ${attr.name} reference ("${val.slice(0, 60)}").`
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

      if (
        /^(javascript|vbscript):/i.test(val) ||
        /^data:\s*(text\/html|image\/svg\+xml)/i.test(val)
      ) {
        securityFindings.push(`Removed unsafe URI in attribute "${attr.name}".`);
        el.removeAttribute(attr.name);
        continue;
      }

      if (name === 'style') {
        if (
          /javascript\s*:|vbscript\s*:|expression\s*\(|-moz-binding|behavior\s*:|data\s*:\s*text\/html/i.test(
            val
          )
        ) {
          securityFindings.push('Removed unsafe inline style declaration.');
          el.removeAttribute(attr.name);
        } else if (/url\s*\(\s*['"]?(?!#)[^)'"]+['"]?\s*\)/i.test(val)) {
          securityFindings.push('Replaced external url() inside inline style.');
          const cleaned = val.replace(
            /url\s*\(\s*['"]?(?!#)[^)]+['"]?\s*\)/gi,
            'none'
          );
          el.setAttribute(attr.name, cleaned);
        }
      } else if (
        (name === 'fill' ||
          name === 'stroke' ||
          name === 'clip-path' ||
          name === 'mask' ||
          name === 'filter' ||
          name === 'marker-start' ||
          name === 'marker-mid' ||
          name === 'marker-end') &&
        /url\s*\(\s*['"]?(?!#)[^)'"]+['"]?\s*\)/i.test(val)
      ) {
        securityFindings.push(`Removed external url() reference in "${attr.name}".`);
        el.removeAttribute(attr.name);
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

  const viewBox = svgRoot.getAttribute('viewBox') || '0 0 1500 2100';

  return {
    rootElement: svgRoot as unknown as SVGSVGElement,
    viewBox,
    securityFindings,
  };
}
