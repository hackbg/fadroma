# `@hackbg/kabinet`

Classes for accessing the filesystem.

```javascript
import { Directory, TextFile } from '@hackbg/kabinet'

new Directory(__dirname, 'data')
  .make()
  .save('file.txt', 'my data')

new TextFile(__dirname, 'data', 'file.txt')
  .load()
```
