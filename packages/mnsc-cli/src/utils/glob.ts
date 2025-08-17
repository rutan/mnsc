import { glob } from 'glob';
import { createError, ErrorCodes } from './errors';
import type { Logger } from './logger';

export async function resolveMnscInputFiles(inputs: string[], logger?: Logger): Promise<string[]> {
  const files: string[] = [];

  for (const input of inputs) {
    const matches = await glob(input, { nodir: true });
    if (matches.length === 0) {
      logger?.warn(`No files found matching pattern: ${input}`);
    } else {
      files.push(...matches);
    }
  }

  if (files.length === 0) {
    throw createError(ErrorCodes.FILE_NOT_FOUND, 'No input files found');
  }

  const mnscFiles = files.filter((f) => f.endsWith('.mnsc'));
  if (mnscFiles.length === 0) {
    throw createError(ErrorCodes.FILE_NOT_FOUND, 'No MNSC files found');
  }

  return mnscFiles;
}

export function normalizeMnscWatchPatterns(inputs: string[]): string[] {
  return inputs.map((raw) => {
    const pattern = raw.trim();
    // Already a specific file or explicit pattern
    if (pattern.endsWith('.mnsc')) return pattern;
    if (/\*\*\/[\w*]*\.mnsc$/.test(pattern)) return pattern; // already like **/*.mnsc or **/*something.mnsc

    // Trim trailing wildcards and slashes to infer a base directory
    const base = pattern.replace(/([/*])+$/g, '').replace(/\/$/, '');
    const prefix = base.length > 0 ? base : pattern.replace(/\/$/, '');
    // Fallback to full recursive match of .mnsc files
    return `${prefix}/**/*.mnsc`;
  });
}
