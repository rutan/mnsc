import type { BlockCommand, Command, IfCommand, Mnsc } from '@rutan/mnsc';
import { parse } from '@rutan/mnsc';
import * as vscode from 'vscode';
import { getConfig } from '../config';

export function maybeValidate(doc: vscode.TextDocument, collection: vscode.DiagnosticCollection) {
  if (doc.languageId !== 'mnsc') return;

  const config = getConfig();
  const diagnostics: vscode.Diagnostic[] = [];
  const text = doc.getText();
  let ast: Mnsc;

  try {
    ast = parse(text, {
      includeLoc: true,
      frontMatterParser: config.diagnostics.validateFrontMatter ? undefined : (_raw) => ({}),
    });
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
    collection.set(doc.uri, diagnostics);
    return;
  }

  // Additional semantic warnings
  if (config.diagnostics.warnUnknownFunctions) {
    const known = new Set((config.functions ?? []).map((f) => f.name));
    const reserved = new Set(['text', 'label', 'item', 'if']);
    const addWarn = (offsetStart: number | undefined, offsetEnd: number | undefined, name: string) => {
      if (offsetStart == null || offsetEnd == null) return;
      const slice = text.slice(offsetStart, offsetEnd);
      const idx = slice.indexOf(name);
      const startOffset = idx >= 0 ? offsetStart + idx : offsetStart;
      const endOffset = idx >= 0 ? startOffset + name.length : startOffset;
      const range = new vscode.Range(doc.positionAt(startOffset), doc.positionAt(endOffset));
      diagnostics.push(
        new vscode.Diagnostic(
          range,
          `Unknown function '${name}'. Add it to mnsc.functions to enable completions and signature help.`,
          vscode.DiagnosticSeverity.Warning,
        ),
      );
    };
    const visit = (node: Command | Command[] | undefined) => {
      if (!node) return;
      if (Array.isArray(node)) {
        for (const c of node) visit(c);
        return;
      }

      const name = node.command;
      if (!reserved.has(name) && !known.has(name)) {
        const s = node.loc?.start?.offset as number | undefined;
        const e = node.loc?.end?.offset as number | undefined;
        addWarn(s, e, name);
      }
      if ((node as BlockCommand).children) visit((node as BlockCommand).children);
      if ((node as IfCommand).branches) {
        for (const b of (node as IfCommand).branches) visit(b.children);
      }
    };
    visit(ast.commands);
  }

  // Unknown character name warnings
  if (config.diagnostics.warnUnknownCharacters || config.diagnostics.warnUnknownFaces) {
    const knownChars = new Map<string, string[] | undefined>();
    for (const c of config.characters ?? []) knownChars.set(c.name, c.faces);

    const addWarnAtName = (node: Command, name: string) => {
      const s = node.loc?.start?.offset as number | undefined;
      const e = node.loc?.end?.offset as number | undefined;
      if (s == null || e == null) return;

      const slice = text.slice(s, e);
      const idx = slice.indexOf(`${name}:`);
      const startOffset = idx >= 0 ? s + idx : s;
      const endOffset = idx >= 0 ? startOffset + name.length : startOffset;
      const range = new vscode.Range(doc.positionAt(startOffset), doc.positionAt(endOffset));
      diagnostics.push(
        new vscode.Diagnostic(
          range,
          `Unknown character '${name}'. Add it to mnsc.characters.`,
          vscode.DiagnosticSeverity.Warning,
        ),
      );
    };

    const addWarnAtFace = (node: Command, face: string) => {
      const s = node.loc?.start?.offset as number | undefined;
      const e = node.loc?.end?.offset as number | undefined;
      if (s == null || e == null) return;

      const slice = text.slice(s, e);
      const token = `'${face}'`;
      const idx = slice.indexOf(token);
      const startOffset = idx >= 0 ? s + idx + 1 : s; // include quotes -> highlight inner
      const endOffset = idx >= 0 ? startOffset + face.length : startOffset;
      const range = new vscode.Range(doc.positionAt(startOffset), doc.positionAt(endOffset));
      diagnostics.push(
        new vscode.Diagnostic(
          range,
          `Unknown face '${face}' for character. Add it to mnsc.characters[].faces.`,
          vscode.DiagnosticSeverity.Warning,
        ),
      );
    };

    const visitTalk = (node: Command | Command[] | undefined) => {
      if (!node) return;
      if (Array.isArray(node)) {
        for (const c of node) visitTalk(c);
        return;
      }
      if (node.command === 'text') {
        const args = (node as Command).args as unknown[];
        const meta = (args?.[1] ?? {}) as { name?: string; face?: string; [k: string]: unknown };
        const charName = meta.name;
        const face = meta.face as string | undefined;
        const knownFaces = charName ? knownChars.get(charName) : undefined;
        if (config.diagnostics.warnUnknownCharacters && charName && !knownChars.has(charName)) {
          addWarnAtName(node, charName);
        }
        if (
          config.diagnostics.warnUnknownFaces &&
          face &&
          charName &&
          knownFaces &&
          Array.isArray(knownFaces) &&
          !knownFaces.includes(face)
        ) {
          addWarnAtFace(node, face);
        }
      }
      // traverse children/branches if present to catch nested text
      if ((node as BlockCommand).children) visitTalk((node as BlockCommand).children);
      if ((node as IfCommand).branches) {
        for (const b of (node as IfCommand).branches) visitTalk(b.children);
      }
    };
    visitTalk(ast.commands);
  }

  collection.set(doc.uri, diagnostics);
}
