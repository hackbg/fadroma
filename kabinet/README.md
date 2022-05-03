---
literate: typescript
---
# `@hackbg/kabinet`

**Classes for accessing the filesystem.**

Your OS's filesystem isn't the most powerful database by far,
it's the most human-friendly one out there.

Exports `File` and `Directory` classes, as well as example `JSON` subclasses of the same
that take care of extensions and the data format. `YAML` and `TOML` subclasses are planned,
too.

Reexports `fs`, `fs/promises`, as well as `mkdirp` and `rimraf`.

Basis of the Receipts subsystem in Fadroma. A "receipt" is a good metaphor
for the kind of data best stored with this module: a record of a meaningful
interaction between a user and a system, which is stored *with the user*
(as it's recorded by the system's state, anyway). Think keeping track of
what programs (e.g. smart contracts) you uploaded to an append-only public
compute service (e.g. a programmable blockchain).

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
