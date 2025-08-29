import * as vscode from 'vscode';

export type MnscUserFunction = { name: string; args?: Array<string | { name: string; type?: string }> };
export type MnscCharacter = { name: string; faces?: string[] };

export type MnscConfig = {
  functions: MnscUserFunction[];
  characters: MnscCharacter[];
  generateIds: { onSave: boolean; format: 'uuid' | 'hash' };
  diagnostics: { warnUnknownFunctions: boolean; warnUnknownCharacters: boolean; warnUnknownFaces: boolean };
};

let cached: MnscConfig | undefined;
const listeners = new Set<(cfg: MnscConfig) => void>();

function readConfig(): MnscConfig {
  const c = vscode.workspace.getConfiguration('mnsc');
  return {
    functions: c.get<MnscUserFunction[]>('functions', []),
    characters: c.get<MnscCharacter[]>('characters', []),
    generateIds: {
      onSave: c.get<boolean>('generateIds.onSave', false),
      format: c.get<'uuid' | 'hash'>('generateIds.format', 'uuid'),
    },
    diagnostics: {
      warnUnknownFunctions: c.get<boolean>('diagnostics.warnUnknownFunctions', false),
      warnUnknownCharacters: c.get<boolean>('diagnostics.warnUnknownCharacters', false),
      warnUnknownFaces: c.get<boolean>('diagnostics.warnUnknownFaces', false),
    },
  };
}
export function getConfig(): MnscConfig {
  if (!cached) cached = readConfig();
  return cached;
}

export function onConfigChange(fn: (cfg: MnscConfig) => void): vscode.Disposable {
  listeners.add(fn);
  return new vscode.Disposable(() => listeners.delete(fn));
}

export function registerConfigWatcher(context: vscode.ExtensionContext): void {
  const sub = vscode.workspace.onDidChangeConfiguration((e) => {
    if (!e.affectsConfiguration('mnsc')) return;
    cached = undefined;
    const cfg = getConfig();
    for (const l of listeners) l(cfg);
  });
  context.subscriptions.push(sub);
}
