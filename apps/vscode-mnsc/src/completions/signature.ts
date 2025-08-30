import * as vscode from 'vscode';
import { getConfig } from '../config';

export class MnscSignatureHelpProvider implements vscode.SignatureHelpProvider {
  provideSignatureHelp(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.SignatureHelp> {
    const line = document.lineAt(position.line).text.substring(0, position.character);
    const match = line.match(/<<<?\s*(?<fname>[A-Za-z_][A-Za-z0-9_]*)\s*\((?<inside>[^)]*)$/);
    const fname = match?.groups?.fname;
    if (!fname) return null;

    const fn = getConfig().functions.find((f) => f.name === fname);
    if (!fn) return null;

    const inside = match?.groups?.inside ?? '';
    const posArgs = fn.positional ?? [];
    const namedArgs = fn.named ?? [];
    const allNames: string[] = [...posArgs.map((a) => a.name), ...namedArgs.map((a) => `${a.name}:`)];

    // Naive split by comma to determine current segment index
    const segments = inside === '' ? [] : inside.split(',');
    const segIndex = segments.length === 0 ? 0 : segments.length - 1;

    // Determine active parameter index: positional first, then named
    let activeIndex = 0;
    const firstNamedIdx = segments.findIndex((s) => s.includes(':'));
    if (firstNamedIdx === -1) {
      activeIndex = Math.min(segIndex, Math.max(0, posArgs.length - 1));
    } else if (segIndex < firstNamedIdx) {
      activeIndex = Math.min(segIndex, Math.max(0, posArgs.length - 1));
    } else {
      const current = segments[segIndex] ?? '';
      const key = current.split(':')[0]?.trim();
      const namedIdx = Math.max(
        0,
        namedArgs.findIndex((a) => a.name === key),
      );
      activeIndex = posArgs.length + (namedIdx >= 0 ? namedIdx : 0);
    }

    const sigInfo = new vscode.SignatureInformation(`${fname}(${allNames.join(', ')})`);
    sigInfo.parameters = allNames.map((a) => new vscode.ParameterInformation(a));

    const help = new vscode.SignatureHelp();
    help.signatures = [sigInfo];
    help.activeSignature = 0;
    help.activeParameter = Math.min(activeIndex, Math.max(0, allNames.length - 1));
    return help;
  }
}
