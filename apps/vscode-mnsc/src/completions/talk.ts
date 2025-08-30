import * as vscode from 'vscode';
import { getConfig } from '../config';

export class TalkCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    doc: vscode.TextDocument,
    pos: vscode.Position,
  ): vscode.ProviderResult<vscode.CompletionItem[]> {
    const cfg = getConfig();
    const line = doc.lineAt(pos.line).text;
    const upToCursor = line.substring(0, pos.character);

    if (/^\s*[^:\r\n]*$/.test(upToCursor)) {
      return cfg.characters.map((c) => new vscode.CompletionItem(c.name, vscode.CompletionItemKind.Value));
    }

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

    const funcCtx = upToCursor.match(/<<<?\s*(?<fname>[A-Za-z_][A-Za-z0-9_]*)\s*\((?<inside>[^)]*)$/);
    if (funcCtx?.groups?.fname) {
      const fn = getConfig().functions.find((f) => f.name === funcCtx.groups?.fname);
      if (!fn) return [];
      const usedKeys = new Set<string>();
      for (const m of funcCtx.groups?.inside.split(',').map((t) => t.trim()) ?? []) {
        const k = m.split(':')[0]?.trim();
        if (k) usedKeys.add(k);
      }
      return fn.named
        .map((a) => a.name)
        .filter((k) => !usedKeys.has(k))
        .map((k) => new vscode.CompletionItem(`${k}: `, vscode.CompletionItemKind.Field));
    }

    return [];
  }
}
