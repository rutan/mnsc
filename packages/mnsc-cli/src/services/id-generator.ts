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

  function collectFromCommands(list: Command[]) {
    for (const command of list) {
      if (!command.id && shouldAssignId(command) && command.loc) {
        const id = generator({
          command,
          index: index++,
          filePath: options.filePath || '',
        });

        logger?.verbose(`Will assign ID "${id}" to ${command.command} command`);

        const insertPosition = command.loc.start.offset;

        commandsToModify.push({
          command,
          id,
          insertPosition,
        });
      }

      // Recurse into block children
      // biome-ignore lint/suspicious/noExplicitAny: union type narrowing by property
      const anyCmd: any = command as any;
      if (anyCmd && Array.isArray(anyCmd.children)) {
        collectFromCommands(anyCmd.children);
      }
      if (anyCmd && anyCmd.command === 'if' && Array.isArray(anyCmd.branches)) {
        for (const br of anyCmd.branches) {
          if (Array.isArray(br.children)) collectFromCommands(br.children);
        }
      }
    }
  }

  collectFromCommands(ast.commands);

  if (commandsToModify.length === 0) {
    logger?.verbose('No commands need ID assignment');
    return content;
  }

  // 位置がずれないように逆順にソートして処理
  commandsToModify.sort((a, b) => b.insertPosition - a.insertPosition);

  let result = content;

  for (const { id, insertPosition } of commandsToModify) {
    // 行頭位置を計算（改行の直後）
    let lineStart = insertPosition - 1;
    while (lineStart >= 0 && result[lineStart] !== '\n' && result[lineStart] !== '\r') {
      lineStart--;
    }
    lineStart++;

    // 対象行のインデント（スペース/タブ）を取得
    let firstNonWs = lineStart;
    while (firstNonWs < result.length && (result[firstNonWs] === ' ' || result[firstNonWs] === '\t')) {
      firstNonWs++;
    }
    const indent = result.slice(lineStart, firstNonWs);

    // 常に行頭に挿入して、インデントを維持
    const idLine = `${indent}#id:${id}\n`;
    result = result.slice(0, lineStart) + idLine + result.slice(lineStart);
  }

  return result;
}

function shouldAssignId(command: Command): boolean {
  return command.command === 'text' || command.command === 'item';
}
