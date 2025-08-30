import { describe, expect, test } from 'vitest';
import { generateHash, generateUuid, getIdGenerator, type IdContext, insertIdsUsingLoc } from './id-generator';
import { parse } from './parse';
import type { Command } from './types';

describe('id-generator (core)', () => {
  describe('generators', () => {
    const mockContext: IdContext = {
      command: { command: 'text', args: ['Test content'] } as Command,
      index: 0,
      filePath: '/test/path.mnsc',
    };

    test('generateUuid produces UUID v4', () => {
      const id = generateUuid();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(id).toMatch(uuidRegex);
    });

    test('generateHash is stable for same content', () => {
      const id1 = generateHash(mockContext);
      const id2 = generateHash(mockContext);
      expect(id1).toBe(id2);
      expect(id1).toHaveLength(8);
    });

    test('getIdGenerator maps formats and falls back', () => {
      const uuidGen = getIdGenerator('uuid');
      const hashGen = getIdGenerator('hash');
      expect(uuidGen({ ...mockContext })).toMatch(/^[0-9a-f-]{36}$/i);
      expect(hashGen({ ...mockContext })).toMatch(/^[0-9a-f]{8}$/);

      // fallback
      // @ts-expect-error invalid on purpose for test
      const fallback = getIdGenerator('invalid');
      expect(fallback({ ...mockContext })).toMatch(/^[0-9a-f-]{36}$/i);
    });
  });

  describe('insertIdsUsingLoc', () => {
    test('inserts IDs for text commands without existing IDs', () => {
      const content = `---\ntitle: Test\n---\n\nFirst paragraph.\n\nSecond paragraph.`;
      const ast = parse(content, { includeLoc: true });
      const result = insertIdsUsingLoc(content, ast, { format: 'hash' });
      expect(result).toMatch(/#id:[0-9a-f]{8}/);
      expect(result).toContain('First paragraph.');
      expect(result).toContain('Second paragraph.');
    });

    test('preserves structure and adds IDs to text commands', () => {
      const content = `---\ntitle: Test\n---\n\nFirst paragraph.\n\nAlice:\n  Hello there!\n\n<<showImage("test.png")>>\n\nFinal paragraph.`;
      const ast = parse(content, { includeLoc: true });
      const result = insertIdsUsingLoc(content, ast, { format: 'hash' });
      expect(result).toContain('---\ntitle: Test\n---');
      expect(result).toContain('Alice:\n  Hello there!');
      expect(result).toContain('<<showImage("test.png")>>');
      expect(result).toMatch(/#id:[0-9a-f]{8}\nFirst paragraph\./);
      expect(result).toMatch(/#id:[0-9a-f]{8}\nFinal paragraph\./);
    });

    test('preserves indentation when inserting IDs inside indented blocks', () => {
      const content = `
---
---
<<<if($love > 10)>>>
  rutan:
    Hello!

  rutan: face: 'smile'
    Bye!
<<</if>>>
`.trim();

      const ast = parse(content, { includeLoc: true });
      const result = insertIdsUsingLoc(content, ast, { format: 'hash' });

      const lines = result.split('\n');
      const firstTalkIdx = lines.findIndex((l) => l.trimStart().startsWith('rutan:') && !l.includes('face:'));
      expect(firstTalkIdx).toBeGreaterThan(0);
      const indent1 = lines[firstTalkIdx].match(/^\s*/)?.[0] ?? '';
      expect(lines[firstTalkIdx - 1]).toMatch(new RegExp(`^${indent1}#id:[0-9a-f]{8}$`));

      const secondTalkIdx = lines.findIndex((l) => l.includes("rutan: face: 'smile'"));
      expect(secondTalkIdx).toBeGreaterThan(0);
      const indent2 = lines[secondTalkIdx].match(/^\s*/)?.[0] ?? '';
      expect(lines[secondTalkIdx - 1]).toMatch(new RegExp(`^${indent2}#id:[0-9a-f]{8}$`));
    });

    test('insert choice item ids', () => {
      const content = `
---
---
<<<choices()>>>
  - Choice1 => *label1
  - Choice2
    => *label2
  - [if($love > 10)]:
    Choice3
    => *label3
<<</choices>>>
`.trim();

      const ast = parse(content, { includeLoc: true });
      const result = insertIdsUsingLoc(content, ast, { format: 'hash' });

      const lines = result.split('\n');
      const itemIdxs = lines
        .map((l, i) => ({ l, i }))
        .filter(({ l }) => l.trimStart().startsWith('- '))
        .map(({ i }) => i);
      expect(itemIdxs.length).toBe(3);
      for (const idx of itemIdxs) {
        const idLine = lines[idx - 1] || '';
        const indent = lines[idx].match(/^\s*/)?.[0] ?? '';
        expect(idLine).toMatch(new RegExp(`^${indent}#id:[0-9a-f]{8}$`));
      }
    });

    test('does not modify commands with existing IDs', () => {
      const content = `---\n---\n\n#id:existing-id\nFirst paragraph.\n\nSecond paragraph.`;
      const ast = parse(content, { includeLoc: true });
      const result = insertIdsUsingLoc(content, ast, { format: 'hash' });
      expect(result).toContain('#id:existing-id\nFirst paragraph.');
      const lines = result.split('\n');
      const secondIdx = lines.findIndex((l) => l.includes('Second paragraph.'));
      const hasIdBeforeSecond = secondIdx > 0 && lines[secondIdx - 1].startsWith('#id:');
      expect(hasIdBeforeSecond).toBe(true);
    });

    test('returns original content when no commands need IDs', () => {
      const content = `---\n---\n\n<<function("test")>>\n\n// Just a comment`;
      const ast = parse(content, { includeLoc: true });
      const result = insertIdsUsingLoc(content, ast, { format: 'hash' });
      expect(result).toBe(content);
    });
  });
});
