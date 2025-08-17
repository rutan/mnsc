import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { registerCompileCommand, registerGenerateIdsCommand, registerValidateCommand } from './commands';
import type { Logger } from './utils';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function createProgram(options: { logger: Logger }): Promise<Command> {
  const packageJsonPath = join(__dirname, '../package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

  const program = new Command();
  program.name('mnsc').description('CLI tool for MNSC parser').version(packageJson.version);

  registerCompileCommand(program, options);
  registerValidateCommand(program, options);
  registerGenerateIdsCommand(program, options);

  return program;
}
