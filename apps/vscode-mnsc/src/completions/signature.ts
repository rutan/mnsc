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

    const args = (fn.args ?? []).map((a) => (typeof a === 'string' ? a : a.name));
    const inside = match?.groups?.inside ?? '';
    const paramIndex = inside.trim() === '' ? 0 : Math.min(inside.split(',').length - 1, Math.max(0, args.length - 1));

    const sigInfo = new vscode.SignatureInformation(`${fname}(${args.join(', ')})`);
    sigInfo.parameters = args.map((a) => new vscode.ParameterInformation(a));

    const help = new vscode.SignatureHelp();
    help.signatures = [sigInfo];
    help.activeSignature = 0;
    help.activeParameter = Math.min(paramIndex, Math.max(0, args.length - 1));
    return help;
  }
}
