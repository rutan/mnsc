import * as vscode from 'vscode';

export type ArgType = 'string' | 'number' | 'boolean' | 'any';
export type ArgSpec = { name: string; type?: ArgType };

// Normalized function signature used by the extension
export type MnscUserFunction = { name: string; positional: ArgSpec[]; named: ArgSpec[] };
export type MnscCharacter = { name: string; faces?: string[] };

export type MnscConfig = {
  functions: MnscUserFunction[];
  characters: MnscCharacter[];
  generateIds: { onSave: boolean; format: 'uuid' | 'hash' };
  diagnostics: {
    warnUnknownFunctions: boolean;
    warnUnknownCharacters: boolean;
    warnUnknownFaces: boolean;
    validateFrontMatter: boolean;
  };
};

let cached: MnscConfig | undefined;
const listeners = new Set<(cfg: MnscConfig) => void>();

function toArgSpec(a: unknown): ArgSpec | null {
  if (typeof a === 'string') return { name: a, type: 'any' };
  if (a && typeof a === 'object') {
    const obj = a as Record<string, unknown>;
    const nameVal = obj.name;
    if (typeof nameVal === 'string') {
      const t = obj.type;
      const isValidType = t === 'string' || t === 'number' || t === 'boolean' || t === 'any';
      return { name: nameVal, type: isValidType ? (t as ArgType) : 'any' };
    }
  }
  return null;
}

function normalizeFunction(f: unknown): MnscUserFunction | null {
  if (!f || typeof f !== 'object') return null;
  const obj = f as Record<string, unknown>;
  const nameVal = obj.name;
  if (typeof nameVal !== 'string') return null;
  const legacyArgs = Array.isArray(obj.args) ? (obj.args as unknown[]) : [];
  const positionalRaw = Array.isArray(obj.positional) ? (obj.positional as unknown[]) : [];
  const namedRaw = Array.isArray(obj.named) ? (obj.named as unknown[]) : [];
  const positional: ArgSpec[] = positionalRaw.map(toArgSpec).filter(Boolean) as ArgSpec[];
  const named: ArgSpec[] = (namedRaw.length > 0 ? namedRaw : legacyArgs).map(toArgSpec).filter(Boolean) as ArgSpec[];
  return { name: nameVal, positional, named };
}

function readConfig(): MnscConfig {
  const c = vscode.workspace.getConfiguration('mnsc');
  // Built-in functions that should always be available for tooling
  const builtins: MnscUserFunction[] = [
    // set($var, value)
    {
      name: 'set',
      positional: [
        { name: 'var', type: 'any' },
        { name: 'value', type: 'any' },
      ],
      named: [],
    },
    // <<<choices()>>>
    { name: 'choices', positional: [], named: [] },
  ];

  // Merge user-configured functions over built-ins by name (user overrides win)
  const userFns = c.get<unknown[]>('functions', []).map(normalizeFunction).filter(Boolean) as MnscUserFunction[];
  const byName = new Map<string, MnscUserFunction>();
  for (const f of builtins) byName.set(f.name, f);
  for (const f of userFns) byName.set(f.name, f);

  return {
    functions: Array.from(byName.values()),
    characters: c.get<MnscCharacter[]>('characters', []),
    generateIds: {
      onSave: c.get<boolean>('generateIds.onSave', false),
      format: c.get<'uuid' | 'hash'>('generateIds.format', 'uuid'),
    },
    diagnostics: {
      warnUnknownFunctions: c.get<boolean>('diagnostics.warnUnknownFunctions', false),
      warnUnknownCharacters: c.get<boolean>('diagnostics.warnUnknownCharacters', false),
      warnUnknownFaces: c.get<boolean>('diagnostics.warnUnknownFaces', false),
      validateFrontMatter: c.get<boolean>('diagnostics.validateFrontMatter', false),
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
