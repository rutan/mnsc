import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createWatcher, type WatcherInstance } from './watcher';

vi.mock('chokidar', () => ({
  watch: vi.fn(() => ({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('watcher', () => {
  let tempDir: string;
  let testFiles: string[];
  let watcher: WatcherInstance | undefined;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `watcher-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    await mkdir(join(tempDir, 'subdir'), { recursive: true });
    await mkdir(join(tempDir, 'node_modules'), { recursive: true });

    testFiles = [join(tempDir, 'a.mnsc'), join(tempDir, 'subdir/b.mnsc')];
    for (const f of testFiles) {
      await writeFile(f, '---\n---\ncontent', 'utf-8');
    }

    await writeFile(join(tempDir, 'node_modules/ignored.mnsc'), 'x', 'utf-8');
  });

  afterEach(async () => {
    try {
      if (watcher) await watcher.close();
      const { rm } = await import('node:fs/promises');
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  test('creates watcher and performs initial processing', async () => {
    const handled: string[] = [];
    watcher = await createWatcher({
      patterns: [join(tempDir, '**/*.mnsc')],
      handler: async (p) => {
        handled.push(p);
      },
      options: {
        logger: { level: 2, error() {}, warn() {}, success() {}, info() {}, debug() {}, verbose() {} },
      },
    });

    expect(watcher).toBeDefined();
    expect(typeof watcher.close).toBe('function');
    expect(typeof watcher.isWatching).toBe('function');
    expect(watcher.isWatching()).toBe(true);

    expect(handled.length).toBeGreaterThanOrEqual(2);

    await watcher.close();
    expect(watcher.isWatching()).toBe(false);
  });
});
