import { insertIdsUsingLoc, parse } from '@rutan/mnsc';
import type { Logger } from '../utils';
import { readFileContent, writeFileContent } from '../utils';

export type IdFormat = 'uuid' | 'hash';

export interface GenerateIdsOptions {
  format?: IdFormat;
  dryRun?: boolean;
  logger?: Logger;
}

// Do not re-export core utilities from CLI

export async function processFileForIds(filePath: string, options: GenerateIdsOptions): Promise<string | undefined> {
  const content = await readFileContent(filePath, options.logger);
  const ast = parse(content, { includeLoc: true });

  const updatedContent = insertIdsUsingLoc(content, ast, { ...options, filePath });

  if (options.dryRun) {
    return updatedContent;
  }

  if (updatedContent !== content) {
    await writeFileContent(filePath, updatedContent, { logger: options.logger });
  } else {
    options.logger?.verbose('No changes detected; skipping write');
  }
  return undefined;
}

// note: insertIdsUsingLoc is imported from @rutan/mnsc (pure, no I/O)
