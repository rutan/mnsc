import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { parse } from './parse';

const exampleDir = join(import.meta.dirname, '../../../examples');

// exampleDir 以下のファイル一覧を取得
const targets = ['choices', 'text', 'talk', 'frontmatter', 'function', 'blockFunction', 'if'];

// biome-ignore lint/suspicious/noExplicitAny: test
function toPrettyJson(object: any) {
  return JSON.stringify(
    object,
    (key, value) => {
      if (key === 'loc') return undefined; // Changed from {} to undefined to remove the key

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return (
          Object.keys(value)
            .sort()
            // biome-ignore lint/suspicious/noExplicitAny: test utility
            .reduce<Record<string, any>>((acc, key) => {
              acc[key] = value[key];
              return acc;
            }, {})
        );
      }
      return value;
    },
    2,
  );
}

describe('parse', () => {
  // success pattern
  targets.forEach((target) => {
    test(`parse ${target}`, async () => {
      const mnscCode = await readFile(join(exampleDir, `${target}.mnsc`), 'utf-8');
      const answerJson = toPrettyJson(JSON.parse(await readFile(join(exampleDir, `${target}.json`), 'utf-8')));
      const result = toPrettyJson(parse(mnscCode));

      expect(result).toBe(answerJson);
    });
  });

  // invalid pattern
  test('no label choice item', () => {
    const mnscCode = `
---
---
<<<choices()>>>
  - item1 => *label1
  - no label item
  - item3 => *label3
<<</choices>>>
    `.trim();

    expect(() => parse(mnscCode)).toThrow('Choice item "no label item" must have a label (=> *labelName)');
  });

  test('division by zero', () => {
    const mnscCode = `
---
---
<<myFunc(10/0)>>
    `.trim();

    expect(() => parse(mnscCode)).toThrow('Division by zero is not allowed');
  });

  // loc option tests
  describe('loc option', () => {
    const mnscCode = `
---
title: test
---
Hello world

<<myFunc(123)>>
    `.trim();

    test('default behavior - loc should not be included', () => {
      const result = parse(mnscCode);

      // Check that commands don't have loc property
      expect(result.commands[0]).not.toHaveProperty('loc');
      expect(result.commands[1]).not.toHaveProperty('loc');
    });

    test('includeLoc: false - loc should not be included', () => {
      const result = parse(mnscCode, { includeLoc: false });

      // Check that commands don't have loc property
      expect(result.commands[0]).not.toHaveProperty('loc');
      expect(result.commands[1]).not.toHaveProperty('loc');
    });

    test('includeLoc: true - loc should be included', () => {
      const result = parse(mnscCode, { includeLoc: true });

      // Check that commands have loc property
      expect(result.commands[0]).toHaveProperty('loc');
      expect(result.commands[1]).toHaveProperty('loc');

      // Verify loc structure
      expect(result.commands[0].loc).toHaveProperty('start');
      expect(result.commands[0].loc).toHaveProperty('end');
      expect(result.commands[0].loc?.start).toHaveProperty('offset');
      expect(result.commands[0].loc?.start).toHaveProperty('line');
      expect(result.commands[0].loc?.start).toHaveProperty('column');
    });

    test('nested structures - loc removal should work recursively', () => {
      const nestedCode = `
---
---
<<<if($flag)>>>
  Text in if block
  <<nestedFunc()>>
<<</if>>>
      `.trim();

      const result = parse(nestedCode, { includeLoc: false });

      // Check that the if command and its nested commands don't have loc
      // biome-ignore lint/suspicious/noExplicitAny: test assertion
      const ifCommand = result.commands[0] as any;
      expect(ifCommand).not.toHaveProperty('loc');
      expect(ifCommand.branches[0].children[0]).not.toHaveProperty('loc');
      expect(ifCommand.branches[0].children[1]).not.toHaveProperty('loc');
    });
  });
});
