import { createHash, randomUUID } from 'node:crypto';
import type { BlockCommand, Command, IfCommand, Mnsc } from '@rutan/mnsc';
import { parse } from '@rutan/mnsc';

export function tryInsertIds(content: string, format: 'uuid' | 'hash', filePath?: string): string | undefined {
  let ast: Mnsc;
  try {
    ast = parse(content, { includeLoc: true });
  } catch {
    return undefined;
  }

  const generator = format === 'hash' ? genHash : genUuid;
  let index = 0;
  const targets: Array<{ insertPosition: number; id: string }> = [];

  const visit = (node: Command | Command[] | undefined) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const c of node) visit(c);
      return;
    }
    const cmd = node as Command;
    if (!cmd.id && cmd.command === 'text' && cmd.loc) {
      const id = generator({ command: cmd, index, filePath: filePath ?? '' });
      index += 1;
      const insertPosition = cmd.loc.start.offset as number;
      targets.push({ insertPosition, id });
    }
    if ((cmd as BlockCommand).children) visit((cmd as BlockCommand).children);
    if ((cmd as IfCommand).branches) {
      for (const b of (cmd as IfCommand).branches) visit(b.children);
    }
  };

  visit(ast.commands as Command[]);

  if (targets.length === 0) return content;

  targets.sort((a, b) => b.insertPosition - a.insertPosition);
  let result = content;
  for (const { insertPosition, id } of targets) {
    const beforeChar = insertPosition > 0 ? result[insertPosition - 1] : '';
    const needsNewline = beforeChar !== '\n' && beforeChar !== '';
    // Preserve current line indentation before the text command
    const lineStart = result.lastIndexOf('\n', insertPosition - 1) + 1;
    const leading = result.slice(lineStart, insertPosition).match(/^\s*/)?.[0] ?? '';
    const idLine = `${leading}#id:${id}\n`;
    const insertText = needsNewline ? `\n${idLine}` : idLine;
    result = result.slice(0, insertPosition) + insertText + result.slice(insertPosition);
  }
  return result;
}
export function genUuid(): string {
  return randomUUID();
}

export function genHash(ctx: { command: Command; index: number; filePath: string }): string {
  const hash = createHash('sha256');
  const data = {
    command: ctx.command.command,
    args: ctx.command.args,
    index: ctx.index,
    filePath: ctx.filePath,
  };
  hash.update(JSON.stringify(data));
  return hash.digest('hex').substring(0, 8);
}
