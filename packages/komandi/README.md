---
literate: typescript
---
# `@hackbg/komandi`

Mini command parser.

```typescript
import runCommands from '@hackbg/komandi'

const commands = {}

commands['simple-sync'] = (...args) => {
  console.log('hello', ...args)
}

commands['simple-async'] = async (...args) => {
  console.log('hello', ...args)
}

commands['nested'] = {
  sync (...args) {
    console.log('hello', ...args)
  },
  async ['async'] (...args) {
    console.log('hello', ...args)
  }
}

runCommands(
  commands,
  process.argv.slice(2),
  `Available commands:\n${Object.keys(commands).join('\n')}`
)
```
