import chalk from 'chalk';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  VERBOSE = 4,
}

export interface Logger {
  level: LogLevel;
  error(message: string): void;
  warn(message: string): void;
  success(message: string): void;
  info(message: string): void;
  debug(message: string): void;
  verbose(message: string): void;
}

export class ConsoleLogger implements Logger {
  private _level: LogLevel;

  constructor(options: { level: LogLevel }) {
    this._level = options.level;
  }

  get level() {
    return this._level;
  }

  set level(level: LogLevel) {
    this._level = level;
  }

  error(message: string) {
    if (this._level >= LogLevel.ERROR) {
      console.error(chalk.red('✖'), message);
    }
  }

  warn(message: string) {
    if (this._level >= LogLevel.WARN) {
      console.warn(chalk.yellow('⚠'), message);
    }
  }

  success(message: string) {
    if (this._level >= LogLevel.INFO) {
      // Route informational logs to stderr to avoid polluting stdout output
      console.error(chalk.green('✓'), message);
    }
  }

  info(message: string) {
    if (this._level >= LogLevel.INFO) {
      console.error(chalk.blue('ℹ'), message);
    }
  }

  debug(message: string) {
    if (this._level >= LogLevel.DEBUG) {
      console.error(chalk.gray('▸'), message);
    }
  }

  verbose(message: string) {
    if (this._level >= LogLevel.VERBOSE) {
      console.error(chalk.gray('▸▸'), message);
    }
  }
}

export function applyLogLevelFromFlags(logger: Logger, flags: { quiet?: boolean; verbose?: boolean }): void {
  if (flags.quiet) {
    logger.level = LogLevel.ERROR;
  } else if (flags.verbose) {
    logger.level = LogLevel.VERBOSE;
  } else {
    logger.level = LogLevel.INFO;
  }
}
