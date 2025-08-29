# MNSC VS Code Extension Tasks

- [x] Config Module
  - [x] Add `src/config.ts` with typed getters for `mnsc.functions`, `mnsc.characters`, `mnsc.generateIds.*`.
  - [x] Implement in-memory cache + `workspace.onDidChangeConfiguration` invalidation.
  - [x] Export `getConfig()`, `onConfigChange(callback)` utilities.

- [x] Signature Help
  - [x] Create `src/completions/signature.ts` implementing `SignatureHelpProvider`.
  - [x] Parse call context: function name + current arg index using `/<<<?\s*(?<fname>[A-Za-z_][A-Za-z0-9_]*)\s*\((?<inside>[^)]*)$/`.
  - [x] Build `SignatureHelp` from `mnsc.functions[]`, listing arg keys; highlight active parameter.
  - [x] Register provider in `activate` with triggers `(` and `,`.

- [x] Completions Refactor
  - [x] Move function name completion to `src/completions/functions.ts`.
  - [x] Move talk/face completion to `src/completions/talk.ts`.
  - [x] Wire both to use `getConfig()`; refresh candidates on `onConfigChange`.

- [x] IDs Module
  - [x] Move `tryInsertIds`, `genUuid`, `genHash` into `src/ids/generate.ts`.
  - [x] Add `src/ids/apply.ts` with `applyIdGenerationToEditor(editor)` using `WorkspaceEdit`.
  - [x] Update `extension.ts` command and on-save hook to use the new module.

- [x] Diagnostics Module
  - [x] Move `maybeValidate` into `src/diagnostics/validate.ts`.
  - [x] Add `src/util/debounce.ts` and reuse from extension entry + diagnostics.
  - [x] Keep error range mapping (use `err.location` if available; fall back to (0,0)).

- [x] Extension Entry Cleanup
  - [x] Slim `src/extension.ts`: imports, registers providers/commands/diagnostics only.
  - [x] Subscribe to `onConfigChange` and refresh behavior where needed.
  - [x] Ensure disposables are tracked and cleared in `deactivate`.

- [ ] Grammar Polish (optional)
  - [ ] Add `beginCaptures`/`endCaptures` for block functions; scope function name and slash.
  - [ ] Scope talk value strings (e.g., `face: 'smile'`) for better theming.

- [ ] Docs & Samples
  - [x] Update `apps/vscode-mnsc/about.md` with config examples and GIFs (completions, signature, IDs).
  - [x] Add `apps/vscode-mnsc/samples/*.mnsc` covering functions, talk, IDs.
  - [ ] Mention settings in `README` of the extension package.

- [ ] Validation
  - [x] Build: `pnpm --filter @rutan/vscode-mnsc build`.
  - [x] Lint: `pnpm lint` at repo root.
  - [ ] Manual E2E in VS Code using `samples/`: highlight, completions, signature help, diagnostics, generate-ids (command and on save).

- [ ] Packaging (nice-to-have)
  - [ ] Set extension `icon` in `apps/vscode-mnsc/package.json`.
  - [ ] Confirm `activationEvents` and `contributes` are accurate after refactor.
