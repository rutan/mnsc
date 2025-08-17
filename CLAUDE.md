# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TypeScript monorepo for the MNSC parser library (@rutan/mnsc) and CLI tool (@rutan/mnsc-cli). MNSC is a custom markup/scripting language designed for narrative content with support for dialogue, choices, and branching logic.

## Common Commands

### Development
- `pnpm install` - Install dependencies
- `pnpm dev` - Run development mode with watch (parallel)
- `pnpm build` - Build all packages using Turbo
- `pnpm test` - Run all tests with Vitest
- `pnpm lint` - Run Biome linter and TypeScript type checking
- `pnpm format` - Format code with Biome
- `pnpm format-fix` - Format code with unsafe fixes

### Package-specific Commands (run from package directory)
- `pnpm gen-parser` - Regenerate parser from Peggy grammar (packages/mnsc)
- `pnpm test:watch` - Run tests in watch mode (packages/mnsc-cli)

### Publishing
- `pnpm release` - Publish packages using changesets
- `pnpm version-packages` - Version packages with changesets

## Architecture

### Monorepo Structure
- **packages/mnsc/** - Core parser library
  - `parser/mnsc-parser.peggy` - Peggy grammar definition (source of truth)
  - `parser/mnsc-parser.js` - Generated parser (DO NOT EDIT - auto-generated)
  - `src/types.ts` - TypeScript types for AST nodes
  - `src/parse.ts` - Main parse function
  
- **packages/mnsc-cli/** - CLI tool for compiling, validating, and watching MNSC files
  - `src/commands/` - CLI command implementations (compile, validate, generate-ids)
  - `src/services/` - Core services (compiler, watcher, id-generator)
  - `src/utils/` - Utilities (logger, file operations, glob patterns)

### MNSC Language Features
- **Front matter**: YAML metadata between `---` markers
- **Text blocks**: Plain paragraphs with optional `#id:` prefixes
- **Talk/Dialogue**: `characterName: content` or `characterName: params: content`
- **Functions**: `<<functionName(args, named: value)>>`
- **Block functions**: `<<<blockName()>>>...<<</blockName>>>`
- **Choices**: Interactive choice blocks with conditions and jumps
- **Labels**: `*labelName` for jump targets
- **Conditionals**: `if` blocks with expression support
- **Comments**: `//` for single-line comments

### Build Pipeline
1. **Parser Generation**: Peggy compiles `.peggy` → `.js` parser
2. **TypeScript Compilation**: tsup builds with ESM output
3. **Turbo Build**: Manages dependency graph and caching
4. **Testing**: Vitest runs unit tests across packages

### Code Style
- **Formatter**: Biome with 2-space indents, 120 line width, single quotes
- **Linter**: Biome with recommended rules
- **TypeScript**: Strict mode enabled, no implicit any
