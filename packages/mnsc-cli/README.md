# @rutan/mnsc-cli

> CLI tool for MNSC parser.

## Usage

### Compile

```bash
# single file
mnsc compile input.mnsc -o output.json --include-loc

# multiple files
mnsc compile src/*.mnsc -o dist/

# watch
mnsc compile src/*.mnsc -o dist/ --watch
```

### Validate

```bash
# single file
mnsc validate input.mnsc

# multiple files
mnsc validate src/*.mnsc
```

### Generate IDs

```bash
mnsc generate-ids src/*.mnsc --format hash
```
