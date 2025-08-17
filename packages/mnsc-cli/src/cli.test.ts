import { join } from 'node:path';
import { beforeEach, describe, expect, type Mock, test, vi } from 'vitest';
import type { Logger } from '../src/utils';

const __dirname = new URL('.', import.meta.url).pathname;

// Mock watcher to intercept runWithWatcher calls
vi.mock('../src/services', async (importActual) => {
  const actual = await (importActual() as Promise<Record<string, unknown>>);
  return {
    ...actual,
    runWithWatcher: vi.fn(async () => {
      // no-op to avoid keeping process alive
    }),
  };
});

// Lazy import after mock
import { createProgram } from '../src/program';
import { runWithWatcher } from '../src/services';

function noopLogger(): Logger {
  return {
    level: 2,
    error() {},
    warn() {},
    success() {},
    info() {},
    debug() {},
    verbose() {},
  };
}

describe('CLI integration (program-level)', () => {
  const fixturesDir = join(__dirname, '../test/fixtures');
  const simple = join(fixturesDir, 'simple.mnsc');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('compile single file prints JSON to stdout', async () => {
    const logger = noopLogger();
    const program = await createProgram({ logger });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['node', 'mnsc', 'compile', simple]);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const output = String(logSpy.mock.calls[0][0]);
    expect(() => JSON.parse(output)).not.toThrow();
    const parsed = JSON.parse(output);
    expect(parsed?.meta?.title).toBe('Simple Test');

    logSpy.mockRestore();
  });

  test('compile watch passes debounce and exclude to watcher', async () => {
    const logger = noopLogger();
    const program = await createProgram({ logger });

    const pattern = join(fixturesDir, '**/*.mnsc');
    await program.parseAsync([
      'node',
      'mnsc',
      'compile',
      pattern,
      '--watch',
      '--debounce',
      '500',
      '--exclude',
      '**/node_modules/**',
    ]);

    expect(runWithWatcher).toHaveBeenCalledTimes(1);
    const call = (runWithWatcher as unknown as Mock).mock.calls[0][0];
    expect(call.options.debounce).toBe(500);
    expect(call.options.exclude).toContain('**/node_modules/**');
    expect(Array.isArray(call.patterns)).toBe(true);
  });
});
