import { createHash, randomUUID } from 'node:crypto';
import type { Command, Mnsc } from '@rutan/mnsc';
import { parse } from '@rutan/mnsc';
import * as vscode from 'vscode';

type MnscConfig = {
  functions: Array<{ name: string; args?: Array<string | { name: string; type?: string }> }>;
  characters: Array<{ name: string; faces?: string[] }>;
  generateIds: { onSave: boolean; format: 'uuid' | 'hash' };
};

export function activate(context: vscode.ExtensionContext) {
  const diagnostics = vscode.languages.createDiagnosticCollection('mnsc');
  context.subscriptions.push(diagnostics);

  // Register command: generate IDs
  context.subscriptions.push(
    vscode.commands.registerCommand('mnsc.generateIds', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'mnsc') return;
      await applyIdGenerationToEditor(editor);
    }),
  );

  // On save: optionally insert IDs
  context.subscriptions.push(
    vscode.workspace.onWillSaveTextDocument(async (e) => {
      const doc = e.document;
      if (doc.languageId !== 'mnsc') return;
      const cfg = getConfig();
      if (!cfg.generateIds.onSave) return;
      const newText = tryInsertIds(doc.getText(), cfg.generateIds.format, doc.fileName);
      if (newText && newText !== doc.getText()) {
        const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
        const edit = new vscode.TextEdit(fullRange, newText);
        e.waitUntil(Promise.resolve([edit]));
      }
    }),
  );

  // Diagnostics: validate on open/change
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => maybeValidate(doc, diagnostics)),
    vscode.workspace.onDidChangeTextDocument(debounce((e) => maybeValidate(e.document, diagnostics), 300)),
  );

  // Completion providers
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider('mnsc', new FunctionCompletionProvider(), '<'),
    vscode.languages.registerCompletionItemProvider('mnsc', new TalkCompletionProvider(), ':', "'", ' '),
  );
}

export function deactivate() {}

async function applyIdGenerationToEditor(editor: vscode.TextEditor) {
  const cfg = getConfig();
  const doc = editor.document;
  const original = doc.getText();
  const updated = tryInsertIds(original, cfg.generateIds.format, doc.fileName);
  if (!updated || updated === original) {
    vscode.window.setStatusBarMessage('MNSC: No ID changes', 1500);
    return;
  }
  await editor.edit((builder) => {
    const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(original.length));
    builder.replace(fullRange, updated);
  });
}

function getConfig(): MnscConfig {
  const c = vscode.workspace.getConfiguration('mnsc');
  return {
    functions: c.get('functions', []),
    characters: c.get('characters', []),
    generateIds: {
      onSave: c.get('generateIds.onSave', false),
      format: c.get('generateIds.format', 'uuid'),
    },
  };
}

// ID insertion ported from CLI logic (pure string transform)
function tryInsertIds(content: string, format: 'uuid' | 'hash', filePath?: string): string | undefined {
  let ast: Mnsc;
  try {
    ast = parse(content, { includeLoc: true });
  } catch {
    // Do not modify if parse fails
    return undefined;
  }

  const generator = format === 'hash' ? genHash : genUuid;
  let index = 0;
  const targets: Array<{ insertPosition: number; id: string }> = [];

  for (const cmd of ast.commands as Command[]) {
    if (!cmd?.id && cmd?.command === 'text' && cmd?.loc) {
      const id = generator({ command: cmd, index, filePath: filePath ?? '' });
      index += 1;
      const insertPosition = cmd.loc.start.offset as number;
      targets.push({ insertPosition, id });
    }
  }

  if (targets.length === 0) return content;

  targets.sort((a, b) => b.insertPosition - a.insertPosition);
  let result = content;
  for (const { insertPosition, id } of targets) {
    const beforeChar = insertPosition > 0 ? result[insertPosition - 1] : '';
    const needsNewline = beforeChar !== '\n' && beforeChar !== '';
    const idLine = `#id:${id}\n`;
    const insertText = needsNewline ? `\n${idLine}` : idLine;
    result = result.slice(0, insertPosition) + insertText + result.slice(insertPosition);
  }
  return result;
}

function genUuid(): string {
  return randomUUID();
}

function genHash(ctx: { command: Command; index: number; filePath: string }): string {
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

function maybeValidate(doc: vscode.TextDocument, collection: vscode.DiagnosticCollection) {
  if (doc.languageId !== 'mnsc') return;
  const diagnostics: vscode.Diagnostic[] = [];
  try {
    parse(doc.getText());
  } catch (err: unknown) {
    const e = err as { message?: string; location?: { start?: { offset?: number }; end?: { offset?: number } } };
    const message = e?.message ?? 'Parse error';
    const loc = e?.location;
    if (loc) {
      const start = doc.positionAt(loc.start?.offset ?? 0);
      const end = doc.positionAt(loc.end?.offset ?? loc.start?.offset ?? 0);
      diagnostics.push(new vscode.Diagnostic(new vscode.Range(start, end), message, vscode.DiagnosticSeverity.Error));
    } else {
      const pos = new vscode.Position(0, 0);
      diagnostics.push(new vscode.Diagnostic(new vscode.Range(pos, pos), message, vscode.DiagnosticSeverity.Error));
    }
  }
  collection.set(doc.uri, diagnostics);
}

class FunctionCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    doc: vscode.TextDocument,
    pos: vscode.Position,
  ): vscode.ProviderResult<vscode.CompletionItem[]> {
    const cfg = getConfig();
    const line = doc.lineAt(pos.line).text.substring(0, pos.character);
    // Offer function names when typing after << or <<< and before '('
    if (!/(<<<?)\s*[A-Za-z_0-9]*$/.test(line)) return [];
    return cfg.functions.map((f) => {
      const item = new vscode.CompletionItem(f.name, vscode.CompletionItemKind.Function);
      item.insertText = f.name;
      item.detail = 'MNSC function';
      return item;
    });
  }
}

class TalkCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    doc: vscode.TextDocument,
    pos: vscode.Position,
  ): vscode.ProviderResult<vscode.CompletionItem[]> {
    const cfg = getConfig();
    const line = doc.lineAt(pos.line).text;
    const upToCursor = line.substring(0, pos.character);

    // Speaker name at start of line before ':'
    if (/^\s*[^:\r\n]*$/.test(upToCursor)) {
      return cfg.characters.map((c) => new vscode.CompletionItem(c.name, vscode.CompletionItemKind.Value));
    }

    // Face value after "face: '"
    const faceMatch = upToCursor.match(/^(?<prefix>[^:]+):.*\bface:\s*'(?<partial>[^']*)$/);
    if (faceMatch?.groups) {
      const speaker = faceMatch.groups.prefix.trim();
      const charCfg = cfg.characters.find((c) => c.name === speaker);
      if (!charCfg?.faces?.length) return [];
      return charCfg.faces.map((f) => {
        const item = new vscode.CompletionItem(f, vscode.CompletionItemKind.EnumMember);
        item.insertText = f;
        return item;
      });
    }

    // Named args inside function parentheses: suggest keys
    const funcCtx = upToCursor.match(/<<<?\s*(?<fname>[A-Za-z_][A-Za-z0-9_]*)\s*\((?<inside>[^)]*)$/);
    if (funcCtx?.groups?.fname) {
      const fn = getConfig().functions.find((f) => f.name === funcCtx.groups?.fname);
      if (!fn?.args) return [];
      const usedKeys = new Set<string>();
      // very naive parse of already-typed named args: key:
      for (const m of funcCtx.groups?.inside.split(',').map((t) => t.trim()) ?? []) {
        const k = m.split(':')[0]?.trim();
        if (k) usedKeys.add(k);
      }
      return fn.args
        .map((a) => (typeof a === 'string' ? a : a.name))
        .filter((k) => !usedKeys.has(k))
        .map((k) => new vscode.CompletionItem(`${k}: `, vscode.CompletionItemKind.Field));
    }

    return [];
  }
}

function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let t: NodeJS.Timeout | undefined;
  return ((...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  }) as T;
}
