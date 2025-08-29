// extension entry
import * as vscode from 'vscode';
import { FunctionCompletionProvider } from './completions/functions';
import { TalkCompletionProvider } from './completions/talk';
import { getConfig, registerConfigWatcher } from './config';
import { maybeValidate } from './diagnostics/validate';
import { applyIdGenerationToEditor } from './ids/apply';
import { tryInsertIds } from './ids/generate';
import { debounce } from './util/debounce';

export async function activate(context: vscode.ExtensionContext) {
  const diagnostics = vscode.languages.createDiagnosticCollection('mnsc');
  context.subscriptions.push(diagnostics);
  registerConfigWatcher(context);

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

  // Signature help provider
  const { MnscSignatureHelpProvider } = await import('./completions/signature');
  context.subscriptions.push(
    vscode.languages.registerSignatureHelpProvider('mnsc', new MnscSignatureHelpProvider(), '(', ','),
  );
}

export function deactivate() {}

// moved helpers into modules
