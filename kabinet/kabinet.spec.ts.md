```typescript
import $, { getDirName, TOMLFile } from './kabinet'

const Spec = {}
export default { Spec }
const test = (obj) => Object.assign(Spec, obj)

const __dirname = getDirName(import.meta.url)

test({
  'basic operation' ({ ok }) {
    ok($(__dirname).assert().isDirectory())
    ok($(__dirname, 'fixtures').assert().isDirectory())
    ok($(__dirname, 'fixtures', 'file.txt').assert().isFile())
  },
  'in/at nesting' ({ ok }) {
    ok($(__dirname).in('fixtures').in('subdir').isDirectory())
    ok($(__dirname).in('fixtures').in('subdir').at('file2.txt').isFile())
  },
  'parse TOML' ({ deepEqual }) {
    deepEqual(
      $(__dirname).in('fixtures').in('subdir').at('file.toml').as(TOMLFile).load(),
      { key: "value", section: { key: "value" } }
    )
  }
})
```
