import { parse as parseFrontMatter } from '../parser/frontmatter-parser';
import { parse as parseMnsc } from '../parser/mnsc-parser';
import type { Mnsc } from './types';

export type FrontMatterParser = (raw: string) => Record<string, unknown>;

export type ParseOptions = {
  includeLoc?: boolean;
  frontMatterParser?: FrontMatterParser;
};

type ParserResult = {
  frontMatter: string | null;
  commands: Mnsc['commands'];
};

const defaultFrontMatterParser: FrontMatterParser = (raw) => {
  if (!raw || !raw.trim()) {
    return {};
  }
  return parseFrontMatter(raw);
};

export function parse(mnscCode: string, options: ParseOptions = {}): Mnsc {
  const { frontMatterParser = defaultFrontMatterParser } = options;
  const result = parseMnsc(mnscCode) as ParserResult;

  const meta = result.frontMatter !== null ? frontMatterParser(result.frontMatter) : {};

  const parsed: Mnsc = {
    meta,
    commands: result.commands,
  };

  if (!options.includeLoc) {
    removeLoc(parsed);
  }

  return parsed;
}

// biome-ignore lint/suspicious/noExplicitAny: recursive object processing
function removeLoc(obj: any): void {
  if (!obj || typeof obj !== 'object') {
    return;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      removeLoc(item);
    }
    return;
  }

  if ('loc' in obj) delete obj.loc;

  for (const key in obj) {
    if (hasOwn(obj, key)) {
      removeLoc(obj[key]);
    }
  }
}

function hasOwn(obj: object, key: PropertyKey) {
  if (typeof Object.hasOwn === 'function') {
    return Object.hasOwn(obj, key);
  }
  // biome-ignore lint/suspicious/noPrototypeBuiltins: ponyfill for Safari 14
  return Object.prototype.hasOwnProperty.call(obj, key);
}
