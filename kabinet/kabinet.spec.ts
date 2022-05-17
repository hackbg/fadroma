import { Path, getDirName, TOMLFormat } from './kabinet'

const Spec = {}
export default { Spec }
const test = (obj) => Object.assign(Spec, obj)

const __dirname = getDirName(import.meta.url)

test({
  'basic operation' ({ ok }) {
    ok(new Path(__dirname).assert().isDir)
    ok(new Path(__dirname, 'fixtures').assert().isDir)
    ok(new Path(__dirname, 'fixtures', 'file.txt').assert().isFile)
  },
  'in/at nesting' ({ ok }) {
    ok(new Path(__dirname).in('fixtures').in('subdir').isDir)
    ok(new Path(__dirname).in('fixtures').in('subdir').at('file2.txt').isFile)
  },
  'parse TOML' ({ deepEqual }) {
    deepEqual(
      new Path(__dirname).in('fixtures').in('subdir').at('file.toml').as(TOMLFormat).load(),
      { key: "value", section: { key: "value" } }
    )
  }
})
