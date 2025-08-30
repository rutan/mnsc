import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { insertIdsUsingLoc } from './id-generator';
import { parse } from './parse';

const fixturesRoot = join(import.meta.dirname, '__fixtures__', 'idgen');

describe('id-generator fixtures', async () => {
  const cases = await discoverCases(fixturesRoot);
  for (const c of cases) {
    test(c.name, async () => {
      const input = await readFile(c.inputPath, 'utf-8');
      const output = await readFile(c.outputPath, 'utf-8');
      const options = c.options;

      const ast = parse(input, { includeLoc: true });
      const result = insertIdsUsingLoc(input, ast, {
        format: options?.format ?? 'hash',
        filePath: options?.filePath ?? 'test.mnsc',
      });

      // Support simple placeholders in expected output: <HEX8>, <UUID>
      const expectedRegex = toRegex(output);
      expect(result).toMatch(expectedRegex);
    });
  }
});

async function discoverCases(root: string) {
  const dirs = await readdir(root, { withFileTypes: true });
  const results: Array<{
    name: string;
    inputPath: string;
    outputPath: string;
    options?: { format?: 'uuid' | 'hash'; filePath?: string };
  }> = [];
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const name = d.name;
    const base = join(root, name);
    results.push({
      name,
      inputPath: join(base, 'input.mnsc'),
      outputPath: join(base, 'output.mnsc'),
      options: undefined,
    });
  }
  return results;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toRegex(expected: string): RegExp {
  // Escape everything, then replace placeholders with patterns
  let pattern = escapeRegex(expected);
  pattern = pattern.replaceAll(escapeRegex('<HEX8>'), '[0-9a-f]{8}');
  pattern = pattern.replaceAll(
    escapeRegex('<UUID>'),
    '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}',
  );
  return new RegExp(`^${pattern}$`, 'm');
}
