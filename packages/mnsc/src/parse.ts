import { parse as parseMnsc } from '../parser/mnsc-parser';
import type { Mnsc } from './types';

export type ParseOptions = {
  includeLoc?: boolean;
};

export function parse(mnscCode: string, options: ParseOptions = {}): Mnsc {
  const result = parseMnsc(mnscCode);

  if (!options.includeLoc) {
    removeLoc(result);
  }

  return result as Mnsc;
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
