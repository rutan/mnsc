import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { processFileForIds } from './id-generator';

describe('ID Generator Service (CLI wrapper)', () => {
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
