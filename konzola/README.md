---
literate: typescript
---
# `@hackbg/konzola`

Pretty console logger.

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
