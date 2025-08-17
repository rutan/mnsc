import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { compile, compileBatch, compileFile, validate, validateFile } from './compiler';

const fixturesDir = join(__dirname, '../../test/fixtures');

describe('Compiler Service', () => {
  describe('compile', () => {
    test('should compile valid MNSC content', () => {
      const content = `---\ntitle: "Test"\n---\nHello World`;

      const result = compile(content);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('meta');
      expect(parsed).toHaveProperty('commands');
      expect(parsed.meta.title).toBe('Test');
    });

    test('should format JSON when pretty option is true', () => {
      const content = `---\n---\nHello World`;

      const result = compile(content, { pretty: true });
      expect(result).toMatch(/\n/); // Should contain newlines
      expect(result).toMatch(/ {2}/); // Should contain indentation
    });

    test('should not include loc by default', () => {
      const content = `---\n---\nHello World`;

      const result = compile(content);
      const parsed = JSON.parse(result);

      expect(parsed.commands[0]).not.toHaveProperty('loc');
    });

    test('should include loc when includeLoc is true', () => {
      const content = `---\n---\nHello World`;

      const result = compile(content, { includeLoc: true });
      const parsed = JSON.parse(result);

      expect(parsed.commands[0]).toHaveProperty('loc');
    });

    test('should throw on invalid content', () => {
      const invalidContent = `---\n---\n<<invalidFunction(`;

      expect(() => compile(invalidContent)).toThrow();
    });
  });

  describe('compileFile', () => {
    test('should compile valid file', async () => {
      const filePath = join(fixturesDir, 'simple.mnsc');
      const result = await compileFile(filePath);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('meta');
      expect(parsed).toHaveProperty('commands');
      expect(parsed.meta.title).toBe('Simple Test');
    });

    test('should throw on non-existent file', async () => {
      const filePath = join(fixturesDir, 'nonexistent.mnsc');
      await expect(compileFile(filePath)).rejects.toThrow();
    });
  });

  describe('compileBatch', () => {
    test('should compile multiple files', async () => {
      const files = [join(fixturesDir, 'simple.mnsc')];
      const results = await compileBatch(files);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].result).toBeDefined();
    });

    test('should handle mixed invalid files', async () => {
      const files = [join(fixturesDir, 'simple.mnsc'), join(fixturesDir, 'syntax-error.mnsc')];
      const results = await compileBatch(files);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBeDefined();
    });
  });

  describe('validate', () => {
    test('should validate correct content', () => {
      const content = `---\ntitle: "Test"\n---\nHello World`;

      expect(validate(content)).toBe(true);
    });

    test('should invalidate incorrect content', () => {
      const content = `---\n---\n<<invalidFunction(`;

      expect(validate(content)).toBe(false);
    });
  });

  describe('validateFile', () => {
    test('should validate existing valid file', async () => {
      const filePath = join(fixturesDir, 'simple.mnsc');
      const result = await validateFile(filePath);

      expect(result).toBe(true);
    });

    test('should invalidate existing invalid file', async () => {
      const filePath = join(fixturesDir, 'syntax-error.mnsc');
      const result = await validateFile(filePath);

      expect(result).toBe(false);
    });

    test('should return false for non-existent file', async () => {
      const filePath = join(fixturesDir, 'nonexistent.mnsc');
      const result = await validateFile(filePath);

      expect(result).toBe(false);
    });
  });
});
