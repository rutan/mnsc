import * as vscode from 'vscode';
import { getConfig } from '../config';

export class FunctionCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    doc: vscode.TextDocument,
    pos: vscode.Position,
  ): vscode.ProviderResult<vscode.CompletionItem[]> {
    const cfg = getConfig();
    const line = doc.lineAt(pos.line).text.substring(0, pos.character);
    if (!/(<<<?)\s*[A-Za-z_0-9]*$/.test(line)) return [];
    return cfg.functions.map((f) => {
      const item = new vscode.CompletionItem(f.name, vscode.CompletionItemKind.Function);
      item.insertText = f.name;
      item.detail = 'MNSC function';
      return item;
    });
  }
}
