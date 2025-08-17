import type { Logger } from './logger';

// カスタムエラータイプ
export class MnscCliError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'MnscCliError';
  }
}

export const ErrorCodes = {
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  PARSE_ERROR: 'PARSE_ERROR',
  WRITE_ERROR: 'WRITE_ERROR',
  INVALID_OPTIONS: 'INVALID_OPTIONS',
  GLOB_ERROR: 'GLOB_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// エラーハンドリング関数
export function handleError(error: unknown, { logger, verbose }: { logger: Logger; verbose?: boolean }): number {
  if (error instanceof MnscCliError) {
    logger.error(`[${error.code}] ${error.message}`);
    if (verbose && error.details) {
      logger.debug(JSON.stringify(error.details, null, 2));
    }
    return 1;
  }

  if (error instanceof Error) {
    if ('code' in error) {
      const nodeError = error as NodeJS.ErrnoException;
      switch (nodeError.code) {
        case 'ENOENT':
          logger.error(`File not found: ${nodeError.path || 'unknown'}`);
          break;
        case 'EACCES':
        case 'EPERM':
          logger.error(`Permission denied: ${nodeError.path || 'unknown'}`);
          break;
        default:
          logger.error(`System error: ${error.message}`);
      }
    } else {
      logger.error(error.message);
    }

    if (verbose && error.stack) logger.debug(error.stack);
    return 1;
  }

  logger.error('An unknown error occurred');
  if (verbose) logger.debug(String(error));
  return 1;
}

export function createError(code: ErrorCode, message: string, details?: unknown): MnscCliError {
  return new MnscCliError(message, code, details);
}

export function fileNotFoundError(filePath: string): MnscCliError {
  return createError(ErrorCodes.FILE_NOT_FOUND, `File not found: ${filePath}`, { filePath });
}

export function parseError(message: string, filePath?: string, details?: unknown): MnscCliError {
  return createError(ErrorCodes.PARSE_ERROR, `Parse error: ${message}`, {
    filePath,
    ...(details && typeof details === 'object' ? details : {}),
  });
}

export function writeError(filePath: string, details?: unknown): MnscCliError {
  return createError(ErrorCodes.WRITE_ERROR, `Failed to write file: ${filePath}`, {
    filePath,
    ...(details && typeof details === 'object' ? details : {}),
  });
}

export function invalidOptionsError(message: string, details?: unknown): MnscCliError {
  return createError(ErrorCodes.INVALID_OPTIONS, `Invalid options: ${message}`, details);
}
