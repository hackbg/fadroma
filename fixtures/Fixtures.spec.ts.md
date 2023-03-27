# Fixtures

* Files with a fixed content that are used in the test suites.
* Stored in [./fixtures](./fixtures/README.md).
* TODO use `fetch` instead of Node FS API

```typescript
import { Console, bold } from '@hackbg/logs'
import $ from '@hackbg/file'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
```

```typescript
export const here      = dirname(fileURLToPath(import.meta.url))
export const workspace = resolve(here)
export const fixture   = x => resolve(here, 'fixtures', x)
export const log       = new Console('Fadroma Testing')
```

