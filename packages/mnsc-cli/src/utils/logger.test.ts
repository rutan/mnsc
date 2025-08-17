import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ConsoleLogger, LogLevel } from './logger';

describe('ConsoleLogger', () => {
  const mockConsoleError = vi.fn();
  const mockConsoleWarn = vi.fn();

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(mockConsoleError);
    vi.spyOn(console, 'warn').mockImplementation(mockConsoleWarn);
    mockConsoleError.mockClear();
    mockConsoleWarn.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('respects log levels', () => {
    const logger = new ConsoleLogger({ level: LogLevel.ERROR });
    logger.info('info');
    expect(mockConsoleError).not.toHaveBeenCalled();

    logger.error('err');
    expect(mockConsoleError).toHaveBeenCalled();
  });

  test('routes non-error logs to stderr to avoid stdout pollution', () => {
    const logger = new ConsoleLogger({ level: LogLevel.VERBOSE });
    logger.info('info');
    logger.debug('debug');
    logger.verbose('verbose');
    logger.success('ok');

    // All go through console.error (stderr)
    expect(mockConsoleError).toHaveBeenCalledTimes(4);
  });

  test('warn logs use console.warn', () => {
    const logger = new ConsoleLogger({ level: LogLevel.WARN });
    logger.warn('careful');
    expect(mockConsoleWarn).toHaveBeenCalled();
  });
});
