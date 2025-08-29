# MNSC VS Code Extension Tasks

- [ ] Config Module
  - [ ] Add `src/config.ts` with typed getters for `mnsc.functions`, `mnsc.characters`, `mnsc.generateIds.*`.
  - [ ] Implement in-memory cache + `workspace.onDidChangeConfiguration` invalidation.
  - [ ] Export `getConfig()`, `onConfigChange(callback)` utilities.

- [ ] Signature Help
  - [ ] Create `src/completions/signature.ts` implementing `SignatureHelpProvider`.
  - [ ] Parse call context: function name + current arg index using `/<<<?\s*(?<fname>[A-Za-z_][A-Za-z0-9_]*)\s*\((?<inside>[^)]*)$/`.
  - [ ] Build `SignatureHelp` from `mnsc.functions[]`, listing arg keys; highlight active parameter.
  - [ ] Register provider in `activate` with triggers `(` and `,`.

- [ ] Completions Refactor
  - [ ] Move function name completion to `src/completions/functions.ts`.
  - [ ] Move talk/face completion to `src/completions/talk.ts`.
  - [ ] Wire both to use `getConfig()`; refresh candidates on `onConfigChange`.

- [ ] IDs Module
  - [ ] Move `tryInsertIds`, `genUuid`, `genHash` into `src/ids/generate.ts`.
  - [ ] Add `src/ids/apply.ts` with `applyIdGenerationToEditor(editor)` using `WorkspaceEdit`.
  - [ ] Update `extension.ts` command and on-save hook to use the new module.

- [ ] Diagnostics Module
  - [ ] Move `maybeValidate` into `src/diagnostics/validate.ts`.
  - [ ] Add `src/util/debounce.ts` and reuse from extension entry + diagnostics.
  - [ ] Keep error range mapping (use `err.location` if available; fall back to (0,0)).

- [ ] Extension Entry Cleanup
  - [ ] Slim `src/extension.ts`: imports, registers providers/commands/diagnostics only.
  - [ ] Subscribe to `onConfigChange` and refresh behavior where needed.
  - [ ] Ensure disposables are tracked and cleared in `deactivate`.

- [ ] Grammar Polish (optional)
  - [ ] Add `beginCaptures`/`endCaptures` for block functions; scope function name and slash.
  - [ ] Scope talk value strings (e.g., `face: 'smile'`) for better theming.

- [ ] Docs & Samples
  - [ ] Update `apps/vscode-mnsc/about.md` with config examples and GIFs (completions, signature, IDs).
  - [ ] Add `apps/vscode-mnsc/samples/*.mnsc` covering functions, talk, IDs.
  - [ ] Mention settings in `README` of the extension package.

- [ ] Validation
  - [ ] Build: `pnpm --filter @rutan/vscode-mnsc build`.
  - [ ] Lint: `pnpm lint` at repo root.
  - [ ] Manual E2E in VS Code using `samples/`: highlight, completions, signature help, diagnostics, generate-ids (command and on save).

- [ ] Packaging (nice-to-have)
  - [ ] Set extension `icon` in `apps/vscode-mnsc/package.json`.
  - [ ] Confirm `activationEvents` and `contributes` are accurate after refactor.

