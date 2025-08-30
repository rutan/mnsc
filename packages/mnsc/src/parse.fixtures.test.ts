import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { parse } from './parse';

const fixturesRoot = join(import.meta.dirname, '__fixtures__', 'parse');

// Pretty JSON helper matching prior tests: remove `loc` and sort object keys
function toPrettyJson(object: unknown) {
  return JSON.stringify(
    object,
    (key, value) => {
      if (key === 'loc') return undefined;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const v = value as Record<string, unknown>;
        return Object.keys(v)
          .sort()
          .reduce<Record<string, unknown>>((acc, k) => {
            acc[k] = v[k];
            return acc;
          }, {});
      }
      return value;
    },
    2,
  );
}

describe('parse fixtures', async () => {
  const cases = await discoverCases(fixturesRoot);
  for (const c of cases) {
    test(c.name, async () => {
      const mnsc = await readFile(c.inputPath, 'utf-8');
      const expected = JSON.parse(await readFile(c.outputPath, 'utf-8'));
      const result = parse(mnsc);
      expect(toPrettyJson(result)).toBe(toPrettyJson(expected));
    });
  }
});

async function discoverCases(root: string) {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const results: Array<{ name: string; inputPath: string; outputPath: string }> = [];
    for (const d of entries) {
      if (!d.isDirectory()) continue;
      const name = d.name;
      const base = join(root, name);
      results.push({
        name,
        inputPath: join(base, 'input.mnsc'),
        outputPath: join(base, 'output.json'),
      });
    }
    return results;
  } catch {
    return [];
  }
}
