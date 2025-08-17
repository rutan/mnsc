# Repository Guidelines

## Project Structure & Module Organization
- Monorepo managed by `pnpm` and `turbo`.
- Packages:
  - `packages/mnsc`: core parser library (Peggy grammar → TS build).
  - `packages/mnsc-cli`: CLI wrapping the parser, utilities, and commands.
- Tests:
  - Library: `packages/mnsc/src/*.test.ts` (adjacent to sources).
  - CLI: `packages/mnsc-cli/test/**` with fixtures under `packages/mnsc-cli/test/fixtures/`.
- Examples live in `examples/`.
- Parser grammar: `packages/mnsc/parser/mnsc-parser.peggy` (regenerate when changed).

## Build, Test, and Development Commands
- Root:
  - `pnpm build`: `turbo run build` across packages.
  - `pnpm dev`: parallel watch builds where supported.
  - `pnpm test`: run all package tests via Turbo.
  - `pnpm lint`: Biome lint + `tsc --noEmit` type checks.
  - `pnpm format` / `pnpm format-fix`: format with Biome.
- Package (use filter):
  - `pnpm --filter @rutan/mnsc gen-parser`: regenerate parser from Peggy.
  - `pnpm --filter @rutan/mnsc build`: build core library.
  - `pnpm --filter @rutan/mnsc-cli dev`: watch-build CLI with tsup.
  - `pnpm --filter @rutan/mnsc-cli test`: run CLI tests only.

## Coding Style & Naming Conventions
- Language: TypeScript (ESM). Node ≥ 18 required for the CLI.
- Formatting/linting: Biome (`biome.jsonc`), 2-space indent, single quotes.
- Types: `pnpm lint` runs `tsc --noEmit`.
- Naming: `camelCase` variables/functions, `PascalCase` types/classes, `kebab-case` files.

## Testing Guidelines
- Framework: Vitest; coverage configured in `packages/mnsc-cli/vitest.config.ts`.
- Naming: `*.test.ts`.
- Locations: CLI tests under `packages/mnsc-cli/test/`; library tests next to sources.
- Run targeted tests: `pnpm --filter <pkg> test`.
- Use fixtures under `test/fixtures/` when helpful.

## Commit & Pull Request Guidelines
- Commits: scope by package, e.g., `feat(cli): add validate command`, `fix(core): correct parse error`.
- PRs include: clear description/motivation, CLI output or screenshots (if relevant), linked issues, breaking-change notes.
- CI readiness: ensure `pnpm build`, `pnpm test`, and `pnpm lint` pass locally before submission.

## Security & Configuration Tips
- When editing `packages/mnsc/parser/mnsc-parser.peggy`, run `pnpm --filter @rutan/mnsc gen-parser`.
- Do not commit `dist/` artifacts; respect Biome ignore rules.
- Avoid committing secrets; prefer environment variables or local config.

