import { parse } from 'node-html-parser';
import type { VariantModification } from './types';

/**
 * Applies a list of variant modifications to an HTML string.
 * Uses node-html-parser for server-side DOM operations.
 */
export function applyModifications(
  html: string,
  modifications: VariantModification[],
): string {
  const root = parse(html);
  const cssRules: string[] = [];

  for (const mod of modifications) {
    switch (mod.type) {
      case 'css-inject': {
        cssRules.push(`${mod.selector} { ${mod.css} }`);
        break;
      }
      case 'text-replace': {
        const el = root.querySelector(mod.selector);
        if (el) el.set_content(mod.text);
        break;
      }
      case 'element-hide': {
        cssRules.push(`${mod.selector} { display: none !important; }`);
        break;
      }
      case 'element-show': {
        cssRules.push(`${mod.selector} { display: block !important; }`);
        break;
      }
      case 'attribute-set': {
        const el = root.querySelector(mod.selector);
        if (el) el.setAttribute(mod.attr, mod.value);
        break;
      }
      case 'element-reorder': {
        const parent = root.querySelector(mod.parentSelector);
        if (parent) {
          const children = parent.childNodes.filter(
            (n) => n.nodeType === 1,
          );
          for (let i = 0; i < children.length && i < mod.childOrder.length; i++) {
            const child = children[i];
            if ('setAttribute' in child && typeof child.setAttribute === 'function') {
              (child as unknown as { setAttribute: (k: string, v: string) => void }).setAttribute(
                'style',
                `order: ${mod.childOrder[i]};`,
              );
            }
          }
        }
        break;
      }
    }
  }

  if (cssRules.length > 0) {
    const styleTag = `<style data-zybit-variant>${cssRules.join('\n')}</style>`;
    const headClose = root.querySelector('head');
    if (headClose) {
      headClose.insertAdjacentHTML('beforeend', styleTag);
    } else {
      // Fallback: prepend to document
      return styleTag + root.toString();
    }
  }

  return root.toString();
}
