import type { Command, Mnsc } from './types';

export type IdFormat = 'uuid' | 'hash';

export interface IdContext {
  command: Command;
  index: number;
  filePath?: string;
}

export type IdGenerator = (context: IdContext) => string;

export function generateUuid(): string {
  // RFC 4122 v4 UUID, using Math.random fallback to avoid Node/browser crypto dependency
  // Sets version and variant bits correctly.
  let uuid = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else if (i === 14) {
      uuid += '4';
    } else {
      const r = Math.floor(Math.random() * 16);
      if (i === 19) {
        uuid += ((r & 0x3) | 0x8).toString(16);
      } else {
        uuid += r.toString(16);
      }
    }
  }
  return uuid;
}

export function generateHash(context: IdContext): string {
  // Deterministic 32-bit FNV-1a hash over stable JSON of context
  const stable = stableStringify({
    command: context.command.command,
    args: context.command.args,
    index: context.index,
    filePath: context.filePath ?? '',
  });
  const hash32 = fnv1a(stable);
  // to 8-hex lowercase
  return (hash32 >>> 0).toString(16).padStart(8, '0');
}

export function getIdGenerator(format: IdFormat = 'uuid'): IdGenerator {
  return format === 'hash' ? generateHash : generateUuid;
}

export interface GenerateIdsOptions {
  format?: IdFormat;
}

export function insertIdsUsingLoc(
  content: string,
  ast: Mnsc,
  options: GenerateIdsOptions & { filePath?: string } = {},
): string {
  const generator = getIdGenerator(options.format);
  let index = 0;

  const commandsToModify: Array<{
    command: Command;
    id: string;
    insertPosition: number;
  }> = [];

  function collect(list: Command[]) {
    for (const command of list) {
      if (!command.id && shouldAssignId(command) && command.loc) {
        const id = generator({ command, index: index++, filePath: options.filePath });
        const insertPosition = command.loc.start.offset;
        commandsToModify.push({ command, id, insertPosition });
      }

      const anyCmd = command as unknown as {
        children?: Command[];
        branches?: Array<{ children: Command[] }>;
        command: string;
      };
      if (Array.isArray(anyCmd.children)) collect(anyCmd.children);
      if (anyCmd.command === 'if' && Array.isArray(anyCmd.branches)) {
        for (const br of anyCmd.branches) collect(br.children || []);
      }
    }
  }

  collect(ast.commands);

  if (commandsToModify.length === 0) return content;

  commandsToModify.sort((a, b) => b.insertPosition - a.insertPosition);

  let result = content;
  for (const { id, insertPosition } of commandsToModify) {
    // find line start
    let lineStart = insertPosition - 1;
    while (lineStart >= 0 && result[lineStart] !== '\n' && result[lineStart] !== '\r') lineStart--;
    lineStart++;

    // leading indent
    let firstNonWs = lineStart;
    while (firstNonWs < result.length && (result[firstNonWs] === ' ' || result[firstNonWs] === '\t')) firstNonWs++;
    const indent = result.slice(lineStart, firstNonWs);

    const idLine = `${indent}#id:${id}\n`;
    result = result.slice(0, lineStart) + idLine + result.slice(lineStart);
  }

  return result;
}

function shouldAssignId(command: Command): boolean {
  return command.command === 'text' || command.command === 'item';
}

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash | 0;
}

// Stable stringify: arrays keep order, objects have sorted keys, handles primitives safely
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) => sortKeys(v));
}

function sortKeys(v: unknown): unknown {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return v;
  const obj = v as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) out[key] = obj[key];
  return out;
}
