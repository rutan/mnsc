import { type FSWatcher, watch } from 'chokidar';
import { glob } from 'glob';
import type { Logger } from '../utils';
import { handleError } from '../utils';
import { DEFAULT_WATCH_IGNORED } from '../utils/config';

export interface WatchOptions {
  logger: Logger;
  debounce?: number;
  exclude?: string[];
}

export interface WatcherInstance {
  close: () => Promise<void>;
  isWatching: () => boolean;
}

export type FileHandler = (filePath: string) => Promise<void>;

export async function createWatcher({
  patterns,
  handler,
  options,
}: {
  patterns: string[];
  handler: FileHandler;
  options: WatchOptions;
}): Promise<WatcherInstance> {
  const { logger } = options;

  logger.verbose(`Creating watcher for patterns: ${patterns.join(', ')}`);

  const processingFiles = new Set<string>();
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const handleFileChange = async (
    filePath: string,
    changeType: 'changed' | 'added',
    handler: FileHandler,
    logger: Logger,
  ) => {
    if (processingFiles.has(filePath)) {
      logger.verbose(`File ${filePath} is already being processed, skipping...`);
      return;
    }

    try {
      processingFiles.add(filePath);
      logger.info(`File ${changeType}: ${filePath}`);
      const startTime = Date.now();

      await handler(filePath);

      const duration = Date.now() - startTime;
      logger.success(`✓ ${filePath} (${duration}ms)`);
    } catch (error) {
      logger.error(`Failed to process ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      processingFiles.delete(filePath);
    }
  };

  // 既定の除外パターンを統合
  const mergedIgnored = Array.from(new Set([...(options.exclude ?? []), ...DEFAULT_WATCH_IGNORED]));

  // 初期ファイルリストを取得（除外パターン考慮）
  const initialFiles: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      nodir: true,
      ignore: mergedIgnored,
    });
    initialFiles.push(...matches);
  }

  if (initialFiles.length === 0) {
    throw new Error('No files found to watch');
  }

  logger.info(`Watching ${initialFiles.length} files...`);
  for (const file of initialFiles) {
    logger.verbose(`  - ${file}`);
  }

  logger.info('Performing initial processing...');

  let successCount = 0;
  let errorCount = 0;

  for (const file of initialFiles) {
    try {
      await handler(file);
      logger.verbose(`✓ ${file}`);
      successCount++;
    } catch (error) {
      logger.error(`✗ ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      errorCount++;
    }
  }

  if (successCount > 0) {
    logger.success(`Initial processing completed: ${successCount} files`);
  }
  if (errorCount > 0) {
    logger.warn(`${errorCount} files failed to process`);
  }

  // chokidarのwatcherを作成
  const watcher: FSWatcher = watch(patterns, {
    ignoreInitial: true,
    persistent: true,
    ignored: mergedIgnored,
  });

  let isActive = true;

  // ファイル変更イベントのハンドリング
  const maybeDebounced = (filePath: string, type: 'changed' | 'added') => {
    const delay = options.debounce ?? 0;
    if (delay > 0) {
      const key = `${type}:${filePath}`;
      const existing = debounceTimers.get(key);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        debounceTimers.delete(key);
        void handleFileChange(filePath, type, handler, logger);
      }, delay);
      debounceTimers.set(key, t);
    } else {
      void handleFileChange(filePath, type, handler, logger);
    }
  };

  watcher.on('change', (filePath: string) => {
    maybeDebounced(filePath, 'changed');
  });

  watcher.on('add', (filePath: string) => {
    maybeDebounced(filePath, 'added');
  });

  watcher.on('unlink', (filePath: string) => {
    logger.info(`File deleted: ${filePath}`);
  });

  watcher.on('error', (err: unknown) => {
    logger.error(`Watcher error: ${err instanceof Error ? err.message : 'Unknown error'}`);
  });

  watcher.on('ready', () => {
    logger.success('File watcher is ready. Waiting for changes...');
    logger.info('Press Ctrl+C to stop watching');
  });

  return {
    close: async () => {
      isActive = false;
      logger.verbose('Closing file watcher...');
      await watcher.close();

      // Clear any pending timers
      for (const [, t] of debounceTimers) clearTimeout(t);
      debounceTimers.clear();

      logger.info('File watcher stopped');
    },
    isWatching: () => isActive,
  };
}

export async function runWithWatcher({
  patterns,
  handler,
  options,
}: {
  patterns: string[];
  handler: FileHandler;
  options: WatchOptions;
}): Promise<void> {
  const watcher = await createWatcher({ patterns, handler, options });

  const gracefulShutdown = async (signal: string) => {
    options.logger.info(`\nReceived ${signal}, stopping watcher...`);
    try {
      await watcher.close();
      if (process.stdin.isTTY) process.stdin.pause();
    } catch (error) {
      handleError(error, { logger: options.logger });
    }
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.stdin.resume();
}
