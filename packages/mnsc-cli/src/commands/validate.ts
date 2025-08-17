import type { Command } from 'commander';
import { runWithWatcher, validateFile } from '../services';
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

interface ValidateCommandOptions {
  quiet?: boolean;
  verbose?: boolean;
  exitOnError?: boolean;
  watch?: boolean;
  debounce?: number;
  exclude?: string[];
}

interface ValidateActionOptions {
  exitOnError?: boolean;
  watch?: boolean;
  debounce?: number;
  exclude?: string[];
  logger: Logger;
}

export function registerValidateCommand(program: Command, { logger }: RegisterCommandOptions): void {
  program
    .command('validate <input...>')
    .description('Validate MNSC files syntax')
    .option('-q, --quiet', 'Quiet mode - only show errors', false)
    .option('-v, --verbose', 'Verbose output', false)
    .option('--exit-on-error', 'Exit with error code if validation fails', true)
    .option('-w, --watch', 'Watch files and revalidate on changes', false)
    .option(
      '--debounce <ms>',
      'Debounce delay in milliseconds for watch mode',
      (val) => parseInt(val, 10),
      DEFAULT_WATCH_DEBOUNCE,
    )
    .option('--exclude <patterns...>', 'Exclude patterns for watch mode (can be specified multiple times)')
    .action(async (inputs: string[], options: ValidateCommandOptions) => {
      applyLogLevelFromFlags(logger, options);

      if (options.watch) {
        await handleWatchMode(inputs, {
          ...options,
          logger,
        });
      } else {
        await handleValidateCommand(inputs, {
          ...options,
          logger,
        });
      }
    });
}

async function handleValidateCommand(inputs: string[], { logger, ...options }: ValidateActionOptions): Promise<void> {
  const mnscFiles = await resolveMnscInputFiles(inputs, logger);

  logger.info(`Validating ${mnscFiles.length} files...`);

  let successCount = 0;
  let errorCount = 0;

  for (const file of mnscFiles) {
    try {
      const isValid = await validateFile(file, { logger });
      if (isValid) {
        logger.success(`✓ ${file}`);
        successCount++;
      } else {
        logger.error(`✗ ${file}: Invalid syntax`);
        errorCount++;
      }
    } catch (error) {
      logger.error(`✗ ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      errorCount++;
    }
  }

  logger.info(`\nValidation completed: ${successCount} valid, ${errorCount} invalid`);

  if (errorCount > 0 && options.exitOnError) {
    throw createError(ErrorCodes.UNKNOWN_ERROR, `${errorCount} files invalid`);
  }
}

async function handleWatchMode(inputs: string[], { logger, ...options }: ValidateActionOptions): Promise<void> {
  const mnscPatterns = normalizeMnscWatchPatterns(inputs);

  const handler = async (filePath: string): Promise<void> => {
    const isValid = await validateFile(filePath, { logger });
    if (isValid) {
      logger.success(`✓ Valid`);
    } else {
      logger.error(`✗ Invalid syntax`);
    }
  };

  await runWithWatcher({
    patterns: mnscPatterns,
    handler,
    options: { logger, debounce: options.debounce, exclude: options.exclude },
  });
}
