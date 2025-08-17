import type { Command } from 'commander';
import { type IdFormat, processFileForIds, runWithWatcher } from '../services';
import {
  applyLogLevelFromFlags,
  createError,
  ErrorCodes,
  type Logger,
  normalizeMnscWatchPatterns,
  resolveMnscInputFiles,
} from '../utils';
import { DEFAULT_WATCH_DEBOUNCE } from '../utils/config';
import type { RegisterCommandOptions } from './types';

interface GenerateIdsCommandOptions {
  format?: IdFormat;
  dryRun?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  watch?: boolean;
  debounce?: number;
  exclude?: string[];
}

interface GenerateIdsActionOptions {
  format?: IdFormat;
  dryRun?: boolean;
  watch?: boolean;
  debounce?: number;
  exclude?: string[];
  logger: Logger;
}

export function registerGenerateIdsCommand(program: Command, { logger }: RegisterCommandOptions): void {
  program
    .command('generate-ids <input...>')
    .description('Generate IDs for MNSC commands that need them')
    .option('--format <format>', 'ID format: uuid, hash', 'uuid')
    .option('--dry-run', 'Show what would be changed without modifying files', false)
    .option('-q, --quiet', 'Quiet mode - only show errors', false)
    .option('-v, --verbose', 'Verbose output', false)
    .option('-w, --watch', 'Watch files and regenerate IDs on changes', false)
    .option(
      '--debounce <ms>',
      'Debounce delay in milliseconds for watch mode',
      (val) => parseInt(val, 10),
      DEFAULT_WATCH_DEBOUNCE,
    )
    .option('--exclude <patterns...>', 'Exclude patterns for watch mode (can be specified multiple times)')
    .action(async (inputs: string[], options: GenerateIdsCommandOptions) => {
      applyLogLevelFromFlags(logger, options);

      if (options.watch) {
        await handleWatchMode(inputs, {
          ...options,
          logger,
        });
      } else {
        await handleGenerateIdsCommand(inputs, {
          ...options,
          logger,
        });
      }
    });
}

async function handleGenerateIdsCommand(
  inputs: string[],
  { logger, ...options }: GenerateIdsActionOptions,
): Promise<void> {
  if (inputs.length === 0) {
    throw createError(ErrorCodes.INVALID_OPTIONS, 'No input files specified');
  }

  if (options.format && !['uuid', 'hash'].includes(options.format)) {
    throw createError(ErrorCodes.INVALID_OPTIONS, 'Format must be one of: uuid, hash');
  }

  const mnscFiles = await resolveMnscInputFiles(inputs, logger);

  if (options.dryRun) {
    logger.info(`Dry run mode: ${mnscFiles.length} files would be processed`);
  } else {
    logger.info(`Processing ${mnscFiles.length} files...`);
  }

  let successCount = 0;
  let errorCount = 0;

  for (const file of mnscFiles) {
    try {
      const result = await processFileForIds(file, {
        format: options.format,
        dryRun: options.dryRun,
        logger,
      });

      if (options.dryRun && result) {
        logger.info(`\n--- ${file} (preview) ---`);
        console.log(result);
        logger.info(`--- End of ${file} ---\n`);
      } else {
        logger.success(`✓ ${file}`);
      }
      successCount++;
    } catch (error) {
      logger.error(`✗ ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      errorCount++;
    }
  }

  if (options.dryRun) {
    logger.info(`\nDry run completed: ${successCount} files would be modified, ${errorCount} errors`);
  } else {
    logger.info(`\nID generation completed: ${successCount} files modified, ${errorCount} errors`);
  }

  if (errorCount > 0) {
    throw createError(ErrorCodes.UNKNOWN_ERROR, `${errorCount} files failed to update IDs`);
  }
}

async function handleWatchMode(inputs: string[], { logger, ...options }: GenerateIdsActionOptions): Promise<void> {
  const mnscPatterns = normalizeMnscWatchPatterns(inputs);

  const handler = async (filePath: string): Promise<void> => {
    await processFileForIds(filePath, {
      format: options.format,
      dryRun: false,
      logger,
    });

    logger.success(`IDs generated`);
  };

  await runWithWatcher({
    patterns: mnscPatterns,
    handler,
    options: { logger, debounce: options.debounce, exclude: options.exclude },
  });
}
