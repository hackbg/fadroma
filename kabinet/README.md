---
literate: typescript
---
# `@hackbg/kabinet`

Classes for accessing the filesystem.

```javascript
import { Directory, TextFile, JSONFile } from '@hackbg/kabinet'

const root = process.cwd()

// Access files through a directory
const dir = new Directory(root, 'data').make()
dir.file(TextFile, 'file.txt').save('my data')
dir.file(JSONFile, 'file.json').save({my:'data'})
console.log(dir.list())

// Or directly
console.log(new TextFile(root, 'data', 'file.txt').load())
console.log(new JSONFile(root, 'data', 'file.json').load())
```
