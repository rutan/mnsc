#!/usr/bin/env node

import { createProgram } from './program';
import { ConsoleLogger, handleError, LogLevel } from './utils';

async function main(): Promise<void> {
  const logger = new ConsoleLogger({ level: LogLevel.INFO });

  try {
    const program = await createProgram({ logger });
    await program.parseAsync(process.argv);
  } catch (error) {
    const code = handleError(error, {
      verbose: process.argv.includes('--verbose'),
      logger,
    });
    process.exit(code);
  }
}

main();
