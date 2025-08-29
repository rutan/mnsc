import * as vscode from 'vscode';
import { getConfig } from '../config';
import { tryInsertIds } from './generate';

export async function applyIdGenerationToEditor(editor: vscode.TextEditor) {
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
