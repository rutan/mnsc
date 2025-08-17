import type { Command } from 'commander';
import { compileBatch, compileFile, runWithWatcher } from '../services';
import {
  applyLogLevelFromFlags,
  createError,
  ErrorCodes,
  generateOutputPath,
  type Logger,
  normalizeMnscWatchPatterns,
  resolveMnscInputFiles,
  safeWriteFile,
  writeFileContent,
} from '../utils';
import type { RegisterCommandOptions } from './types';

interface CompileOptions {
  output?: string;
  includeLoc?: boolean;
  pretty?: boolean;
  force?: boolean;
  watch?: boolean;
  debounce?: number;
  exclude?: string[];
}

interface CompileCommandOptions extends CompileOptions {
  quiet?: boolean;
  verbose?: boolean;
}

interface CompileActionOptions extends CompileOptions {
  logger: Logger;
}

export function registerCompileCommand(program: Command, { logger }: RegisterCommandOptions): void {
  program
    .command('compile <input...>')
    .description('Compile MNSC files to JSON')
    .option('-o, --output <path>', 'Output file or directory')
    .option('--include-loc', 'Include location information in output', false)
    .option('--pretty', 'Pretty print JSON output', false)
    .option('-q, --quiet', 'Quiet mode - only show errors', false)
    .option('-v, --verbose', 'Verbose output', false)
    .option('-f, --force', 'Force overwrite existing files', false)
    .option('-w, --watch', 'Watch files and recompile on changes', false)
    .option('--debounce <ms>', 'Debounce delay in milliseconds for watch mode', (val) => parseInt(val, 10), 300)
    .option('--exclude <patterns...>', 'Exclude patterns for watch mode (can be specified multiple times)')
    .action(async (inputs: string[], options: CompileCommandOptions) => {
      applyLogLevelFromFlags(logger, options);

      if (options.watch) {
        await handleWatchMode(inputs, {
          ...options,
          logger,
        });
      } else {
        await handleCompileCommand(inputs, {
          ...options,
          logger,
        });
      }
    });
}

async function handleCompileCommand(inputs: string[], { logger, ...options }: CompileActionOptions): Promise<void> {
  const mnscFiles = await resolveMnscInputFiles(inputs, logger);

  if (mnscFiles.length === 1) {
    await compileSingleFile(mnscFiles[0], {
      ...options,
      logger,
    });
    return;
  }

  await compileMultipleFiles(mnscFiles, {
    ...options,
    logger,
  });
}

async function compileSingleFile(filePath: string, { logger, ...options }: CompileActionOptions): Promise<void> {
  // Avoid noisy logs when printing JSON to stdout
  if (options.output && options.output !== '-') {
    logger.info(`Compiling ${filePath}...`);
  }

  const result = await compileFile(filePath, {
    includeLoc: options.includeLoc,
    pretty: options.pretty,
    logger,
  });

  if (!options.output || options.output === '-') {
    console.log(result);
  } else {
    const outputPath = generateOutputPath(filePath, options.output);
    const written = await safeWriteFile(outputPath, result, {
      force: options.force,
      createDir: true,
    });

    if (!written) {
      throw createError(ErrorCodes.WRITE_ERROR, `File already exists: ${outputPath}. Use --force to overwrite.`);
    }

    logger.success(`Compiled to ${outputPath}`);
  }
}

async function compileMultipleFiles(files: string[], { logger, ...options }: CompileActionOptions): Promise<void> {
  // When compiling multiple files, treat output as a directory path when provided.
  // Accept paths without a trailing separator for cross-platform compatibility.

  logger.info(`Compiling ${files.length} files...`);

  const results = await compileBatch(files, {
    includeLoc: options.includeLoc,
    pretty: options.pretty,
    logger,
  });

  let successCount = 0;
  let errorCount = 0;

  for (const result of results) {
    if (result.success && result.result) {
      const outputPath = generateOutputPath(result.file, undefined, {
        outputDir: options.output,
        preservePath: true,
      });

      try {
        const written = await safeWriteFile(outputPath, result.result, {
          force: options.force,
          createDir: true,
        });
        if (!written) {
          logger.error(`✗ ${result.file}: File exists. Use --force to overwrite.`);
          errorCount++;
          continue;
        }
        logger.success(`✓ ${result.file} → ${outputPath}`);
        successCount++;
      } catch (_error) {
        logger.error(`✗ ${result.file}: Failed to write output`);
        errorCount++;
      }
    } else if (result.error) {
      logger.error(`✗ ${result.file}: ${result.error.message}`);
      errorCount++;
    }
  }

  logger.info(`\nCompleted: ${successCount} success, ${errorCount} errors`);

  if (errorCount > 0) {
    throw createError(ErrorCodes.UNKNOWN_ERROR, `${errorCount} files failed to compile`);
  }
}

async function handleWatchMode(inputs: string[], { logger, ...options }: CompileActionOptions): Promise<void> {
  const mnscPatterns = normalizeMnscWatchPatterns(inputs);

  const handler = async (filePath: string): Promise<void> => {
    const result = await compileFile(filePath, {
      includeLoc: options.includeLoc,
      pretty: options.pretty,
      logger,
    });

    const outputPath = generateOutputPath(filePath, undefined, {
      outputDir: options.output,
      preservePath: true,
    });

    await writeFileContent(outputPath, result, { createDir: true });
    logger.success(`→ ${outputPath}`);
  };

  await runWithWatcher({
    patterns: mnscPatterns,
    handler,
    options: { logger, debounce: options.debounce, exclude: options.exclude },
  });
}
