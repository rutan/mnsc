import type { Mnsc } from '@rutan/mnsc';
import { insertIdsUsingLoc, parse } from '@rutan/mnsc';

export function tryInsertIds(content: string, format: 'uuid' | 'hash', filePath?: string): string | undefined {
  let ast: Mnsc;
  try {
    ast = parse(content, { includeLoc: true });
  } catch {
    return undefined;
  }

  return insertIdsUsingLoc(content, ast, { format, filePath });
}
