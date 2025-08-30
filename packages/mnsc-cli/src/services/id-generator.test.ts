import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Command } from '@rutan/mnsc';
import { parse } from '@rutan/mnsc';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  generateHash,
  generateUuid,
  getIdGenerator,
  type IdContext,
  insertIdsUsingLoc,
  processFileForIds,
} from './id-generator';

describe('ID Generator Service', () => {
  describe('ID Generators', () => {
    const mockContext: IdContext = {
      command: { command: 'text', args: ['Test content'], id: undefined } as Command,
      index: 0,
      filePath: '/test/path.mnsc',
    };

    test('generateUuid produces UUID v4', () => {
      const id = generateUuid(mockContext);
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(id).toMatch(uuidRegex);
    });

    test('generateHash is stable for same content', () => {
      const id1 = generateHash(mockContext);
      const id2 = generateHash(mockContext);
      expect(id1).toBe(id2);
      expect(id1).toHaveLength(8);
    });

    test('getIdGenerator maps formats', () => {
      const uuidGen = getIdGenerator('uuid');
      const hashGen = getIdGenerator('hash');
      expect(uuidGen(mockContext)).toMatch(/^[0-9a-f-]{36}$/i);
      expect(hashGen(mockContext)).toMatch(/^[0-9a-f]{8}$/);
    });

    test('getIdGenerator falls back to uuid for invalid', () => {
      const generator = getIdGenerator('invalid' as 'uuid');
      const id = generator(mockContext);
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(id).toMatch(uuidRegex);
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

      const expectText = `
---
---
<<<if($love > 10)>>>
  #id:36d8d546
  rutan:
    Hello!

  #id:69927cf3
  rutan: face: 'smile'
    Bye!
<<</if>>>
`.trim();

      const ast = parse(content, { includeLoc: true });
      const result = insertIdsUsingLoc(content, ast, { format: 'hash' });
      expect(result).toBe(expectText);
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

      const expectText = `
---
---
<<<choices()>>>
  #id:fdf0f65c
  - Choice1 => *label1
  #id:69caec7c
  - Choice2
    => *label2
  #id:dcd51a78
  - [if($love > 10)]:
    Choice3
    => *label3
<<</choices>>>
`.trim();

      const ast = parse(content, { includeLoc: true });
      const result = insertIdsUsingLoc(content, ast, { format: 'hash' });
      expect(result).toBe(expectText);
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

  describe('processFileForIds', () => {
    let tempDir: string;
    let testFilePath: string;

    beforeEach(async () => {
      tempDir = join(tmpdir(), `id-generator-test-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });
      testFilePath = join(tempDir, 'test.mnsc');
    });

    afterEach(async () => {
      try {
        const { rm } = await import('node:fs/promises');
        await rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    test('dry-run mode returns modified content', async () => {
      const content = `---\ntitle: Test\n---\n\nTest paragraph.`;
      await writeFile(testFilePath, content, 'utf-8');

      const result = await processFileForIds(testFilePath, { format: 'hash', dryRun: true });
      expect(result).toBeDefined();
      expect(result).toMatch(/#id:[0-9a-f]{8}/);
      const originalContent = await readFile(testFilePath, 'utf-8');
      expect(originalContent).toBe(content);
    });

    test('non-dry-run modifies file on disk', async () => {
      const content = `---\ntitle: Test\n---\n\nTest paragraph.`;
      await writeFile(testFilePath, content, 'utf-8');

      const result = await processFileForIds(testFilePath, { format: 'hash', dryRun: false });
      expect(result).toBeUndefined();
      const modifiedContent = await readFile(testFilePath, 'utf-8');
      expect(modifiedContent).toMatch(/#id:[0-9a-f]{8}/);
      expect(modifiedContent).toContain('Test paragraph.');
      expect(modifiedContent).not.toBe(content);
    });

    test('supports both uuid and hash formats', async () => {
      const content = `---\n---\n\nFirst paragraph.\nSecond paragraph.`;
      await writeFile(testFilePath, content, 'utf-8');

      const uuidResult = await processFileForIds(testFilePath, { format: 'uuid', dryRun: true });
      expect(uuidResult).toMatch(/#id:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);

      const hashResult = await processFileForIds(testFilePath, { format: 'hash', dryRun: true });
      expect(hashResult).toMatch(/#id:[0-9a-f]{8}/);
    });
  });
});
