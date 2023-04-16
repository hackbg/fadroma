# Fixtures

* Files with a fixed content that are used in the test suites.
* Stored in [./fixtures](./fixtures/README.md).
* TODO use `fetch` instead of Node FS API

```typescript
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

import { Console, bold } from '@hackbg/logs'
import $ from '@hackbg/file'
```

```typescript
export const here      = dirname(fileURLToPath(import.meta.url))
export const workspace = resolve(here)
export const fixture   = x => resolve(here, x)
export const log       = new Console('Fadroma Testing')

export const nullWasm = readFileSync(fixture('null.wasm'))
```
