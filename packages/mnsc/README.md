# @rutan/mnsc

> A parser for the MNSC format.

## Example
```typescript
import { parse } from '@rutan/mnsc';

const code = `
title: sample
---

This is a sample document.

rutan: face: 'smile'
  This is talk style text command.
  (and multiline text.)
`;

const result = parse(code);
console.log(result);
```
