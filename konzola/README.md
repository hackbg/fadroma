# `@hackbg/konzola` [![NPM version](https://img.shields.io/npm/v/@hackbg/konzola?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/konzola)

**Pretty console output.**

Makes Node's default plain console output quite a bit easier on the eyes.
Best used as a placeholder before introducing proper structured logging.

Reexports `table`, `colors`, `propmts` and the non-broken version of `prettyjson`

```typescript
import Konzola from '@hackbg/konzola'

const console = Konzola('some identifying prefix')

console.info('FYI')
console.warn('beware!')
console.error('oops :(')
console.debug({pretty: 'printed'})
console.trace({this: 'too'})
console.table([[123,456],[789,101112]])
```
