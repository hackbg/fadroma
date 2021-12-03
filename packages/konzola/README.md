# `@hackbg/konzola`

Pretty console logger.

```javascript
import Console from '@hackbg/konzola'
const console = new Console(import.meta.url)
console.info('hello')
console.warn('hello')
console.debug('formatted', { using: 'prettyjson' })
```
