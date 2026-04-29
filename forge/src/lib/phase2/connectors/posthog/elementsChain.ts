/**
 * Parser for PostHog `elements_chain` strings.
 *
 * The chain is leaf-first, semicolon-separated. Each segment looks like
 * `tag.class1.class2[attr1="v1"][attr2="v2"]:pseudo`. The parser is
 * tolerant: malformed brackets and stray pseudos are skipped instead of
 * raising, since the chain comes from a third-party source.
 *
 * Pure: no I/O, no clocks, no env reads.
 */

export type ParsedLandmark =
  | "header"
  | "nav"
  | "main"
  | "aside"
  | "footer"
  | "dialog";

export interface ParsedElementsChainNode {
  /** Lowercased tag name; '' when the segment lacked a leading tag. */
  tag: string;
  /** Class tokens in declaration order, deduped. */
  classes: string[];
  /** Attribute name → value pairs collected from `[k="v"]` brackets. */
  attrs: Record<string, string>;
  /** True when the segment matches a known landmark tag/role. */
  isLandmark: boolean;
  /** Standardized landmark when `isLandmark`, else null. */
  landmark: ParsedLandmark | null;
}

export interface ParsedElementsChain {
  /** Leaf at index 0; root toward the end. */
  nodes: ParsedElementsChainNode[];
  /** `nodes.length`. Always 0..MAX_CHAIN_NODES. */
  depth: number;
  leaf: ParsedElementsChainNode | null;
  /** Landmark of the closest ancestor (including the leaf). */
  nearestLandmark: ParsedLandmark | null;
  /** Position of the nearest landmark in `nodes` (0 = leaf). null if none. */
  nearestLandmarkDepth: number | null;
}

const MAX_CHAIN_NODES = 50;
const MAX_ATTR_VALUE_LENGTH = 200;

const TAG_LANDMARKS: Readonly<Record<string, ParsedLandmark>> = {
  header: "header",
  nav: "nav",
  main: "main",
  aside: "aside",
  footer: "footer",
  dialog: "dialog",
};

const ROLE_LANDMARKS: Readonly<Record<string, ParsedLandmark>> = {
  banner: "header",
  navigation: "nav",
  main: "main",
  complementary: "aside",
  contentinfo: "footer",
  dialog: "dialog",
};

export function parseElementsChain(
  raw: string | null | undefined,
): ParsedElementsChain {
  if (typeof raw !== "string" || raw.length === 0) {
    return {
      nodes: [],
      depth: 0,
      leaf: null,
      nearestLandmark: null,
      nearestLandmarkDepth: null,
    };
  }

  const segments = splitChain(raw);
  const nodes: ParsedElementsChainNode[] = [];

  for (const segment of segments) {
    if (nodes.length >= MAX_CHAIN_NODES) {
      break;
    }
    const trimmed = segment.trim();
    if (trimmed.length === 0) {
      continue;
    }
    nodes.push(parseSegment(trimmed));
  }

  let nearestLandmark: ParsedLandmark | null = null;
  let nearestLandmarkDepth: number | null = null;
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].isLandmark) {
      nearestLandmark = nodes[i].landmark;
      nearestLandmarkDepth = i;
      break;
    }
  }

  return {
    nodes,
    depth: nodes.length,
    leaf: nodes[0] ?? null,
    nearestLandmark,
    nearestLandmarkDepth,
  };
}

/**
 * Splits the chain on `;` while preserving `[...]` content and respecting
 * backslash escapes (`\;` and `\]` inside attribute values must not break
 * the scanner).
 */
function splitChain(raw: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inBracket = false;
  let escaped = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (escaped) {
      buf += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      buf += ch;
      escaped = true;
      continue;
    }
    if (inBracket) {
      buf += ch;
      if (ch === "]") {
        inBracket = false;
      }
      continue;
    }
    if (ch === "[") {
      buf += ch;
      inBracket = true;
      continue;
    }
    if (ch === ";") {
      out.push(buf);
      buf = "";
      continue;
    }
    buf += ch;
  }

  out.push(buf);
  return out;
}

function parseSegment(segment: string): ParsedElementsChainNode {
  const len = segment.length;
  let i = 0;

  let tag = "";
  while (i < len) {
    const ch = segment[i];
    if (ch === "." || ch === "[" || ch === ":" || ch === "#") {
      break;
    }
    tag += ch;
    i++;
  }
  const normalizedTag = tag.trim().toLowerCase();

  const classes: string[] = [];
  const seenClasses = new Set<string>();
  const attrs: Record<string, string> = {};

  while (i < len) {
    const ch = segment[i];

    if (ch === ".") {
      i++;
      let cls = "";
      while (i < len) {
        const c2 = segment[i];
        if (c2 === "." || c2 === "[" || c2 === ":" || c2 === "#") {
          break;
        }
        cls += c2;
        i++;
      }
      const cleaned = cls.trim();
      if (cleaned.length > 0 && !seenClasses.has(cleaned)) {
        seenClasses.add(cleaned);
        classes.push(cleaned);
      }
      continue;
    }

    if (ch === "[") {
      i = consumeAttribute(segment, i, attrs);
      continue;
    }

    if (ch === ":") {
      // Skip the pseudo selector. Pseudos can carry parenthesised arguments
      // like :nth-child(2) or :not(.foo); we walk through balanced parens
      // so they can't accidentally swallow segment terminators.
      i++;
      while (i < len) {
        const c2 = segment[i];
        if (c2 === "." || c2 === "[" || c2 === ":" || c2 === "#") {
          break;
        }
        if (c2 === "(") {
          i = skipBalancedParens(segment, i);
          continue;
        }
        i++;
      }
      continue;
    }

    if (ch === "#") {
      // IDs are not surfaced by the parser; skip until the next selector boundary.
      i++;
      while (i < len) {
        const c2 = segment[i];
        if (c2 === "." || c2 === "[" || c2 === ":" || c2 === "#") {
          break;
        }
        i++;
      }
      continue;
    }

    i++;
  }

  const landmark = resolveLandmark(normalizedTag, attrs);
  return {
    tag: normalizedTag,
    classes,
    attrs,
    isLandmark: landmark !== null,
    landmark,
  };
}

/**
 * Reads `[name="value"]` (or single-quoted, or unquoted) starting at the
 * opening bracket. Returns the index just past the closing `]`. Handles
 * `\"`, `\'`, and `\\` inside quoted values.
 */
function consumeAttribute(
  segment: string,
  start: number,
  attrs: Record<string, string>,
): number {
  const len = segment.length;
  let i = start + 1;

  let name = "";
  while (i < len && segment[i] !== "=" && segment[i] !== "]") {
    name += segment[i];
    i++;
  }

  let value = "";
  if (i < len && segment[i] === "=") {
    i++;
    let quote: '"' | "'" | null = null;
    if (i < len && (segment[i] === '"' || segment[i] === "'")) {
      quote = segment[i] as '"' | "'";
      i++;
    }
    if (quote !== null) {
      while (i < len && segment[i] !== quote) {
        if (segment[i] === "\\" && i + 1 < len) {
          const next = segment[i + 1];
          if (next === quote || next === "\\") {
            value += next;
            i += 2;
            continue;
          }
        }
        value += segment[i];
        i++;
      }
      if (i < len && segment[i] === quote) {
        i++;
      }
      while (i < len && segment[i] !== "]") {
        i++;
      }
    } else {
      while (i < len && segment[i] !== "]") {
        value += segment[i];
        i++;
      }
    }
  }

  if (i < len && segment[i] === "]") {
    i++;
  }

  const trimmedName = name.trim();
  if (trimmedName.length > 0) {
    attrs[trimmedName] =
      value.length > MAX_ATTR_VALUE_LENGTH
        ? value.slice(0, MAX_ATTR_VALUE_LENGTH)
        : value;
  }

  return i;
}

function skipBalancedParens(segment: string, start: number): number {
  const len = segment.length;
  let depth = 1;
  let i = start + 1;
  while (i < len && depth > 0) {
    const ch = segment[i];
    if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
    }
    i++;
  }
  return i;
}

function resolveLandmark(
  tag: string,
  attrs: Record<string, string>,
): ParsedLandmark | null {
  const tagLandmark = TAG_LANDMARKS[tag];
  if (tagLandmark !== undefined) {
    return tagLandmark;
  }
  const role = attrs.role;
  if (typeof role === "string") {
    const roleLandmark = ROLE_LANDMARKS[role.trim().toLowerCase()];
    if (roleLandmark !== undefined) {
      return roleLandmark;
    }
  }
  return null;
}
