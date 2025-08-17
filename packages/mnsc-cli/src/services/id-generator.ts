import { createHash, randomUUID } from 'node:crypto';
import type { Command, Mnsc } from '@rutan/mnsc';
import { parse } from '@rutan/mnsc';
import type { Logger } from '../utils';
import { readFileContent, writeFileContent } from '../utils';

export type IdFormat = 'uuid' | 'hash';

export interface IdContext {
  command: Command;
  index: number;
  filePath: string;
}

export interface GenerateIdsOptions {
  format?: IdFormat;
  dryRun?: boolean;
  logger?: Logger;
}

export type IdGenerator = (context: IdContext) => string;

export const generateUuid: IdGenerator = () => {
  return randomUUID();
};

export const generateHash: IdGenerator = (context) => {
  const hash = createHash('sha256');

  const hashData = {
    command: context.command.command,
    args: context.command.args,
    index: context.index,
    filePath: context.filePath,
  };
  hash.update(JSON.stringify(hashData));

  return hash.digest('hex').substring(0, 8);
};

export function getIdGenerator(format: IdFormat = 'uuid'): IdGenerator {
  const generators: Record<IdFormat, IdGenerator> = {
    uuid: generateUuid,
    hash: generateHash,
  };

  return generators[format] || generateUuid;
}

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

export function insertIdsUsingLoc(
  content: string,
  ast: Mnsc,
  options: GenerateIdsOptions & { filePath?: string },
): string {
  const logger = options.logger;
  const generator = getIdGenerator(options.format);
  let index = 0;

  // ID挿入対象のコマンドを収集
  const commandsToModify: Array<{
    command: Command;
    id: string;
    insertPosition: number;
  }> = [];

  for (const command of ast.commands) {
    if (!command.id && shouldAssignId(command) && command.loc) {
      const id = generator({
        command,
        index: index++,
        filePath: options.filePath || '',
      });

      logger?.verbose(`Will assign ID "${id}" to ${command.command} command`);

      // コマンドの開始位置を取得
      const insertPosition = command.loc.start.offset;

      commandsToModify.push({
        command,
        id,
        insertPosition,
      });
    }
  }

  if (commandsToModify.length === 0) {
    logger?.verbose('No commands need ID assignment');
    return content;
  }

  // 位置がずれないように逆順にソートして処理
  commandsToModify.sort((a, b) => b.insertPosition - a.insertPosition);

  let result = content;

  for (const { id, insertPosition } of commandsToModify) {
    // 挿入位置の直前に改行があるかチェック
    const beforeChar = insertPosition > 0 ? result[insertPosition - 1] : '';
    const needsNewline = beforeChar !== '\n' && beforeChar !== '';

    const idLine = `#id:${id}\n`;
    const insertText = needsNewline ? `\n${idLine}` : idLine;

    result = result.slice(0, insertPosition) + insertText + result.slice(insertPosition);
  }

  return result;
}

function shouldAssignId(command: Command): boolean {
  return command.command === 'text';
}
