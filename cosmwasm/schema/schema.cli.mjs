#!/usr/bin/env node
import {argv, env, cwd} from 'node:process'
import {dirname, basename, resolve, relative} from 'node:path'
import {existsSync, realpathSync, readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {SchemaToMarkdown} from './schema.mjs'
const { name, version } = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'package.json'))
)
const link = `[${name} ${version}](https://www.npmjs.com/package/${name})`
process.stderr.write(`${name} ${version}\n`)
if (argv.length > 2) {
  const input = argv[2]
  process.stderr.write(`Converting schema: ${argv[2]}\n`)
  const source = readFileSync(input, 'utf8')
  const hash = createHash('sha256').update(source, 'utf8').digest().toString('hex').slice(0, 16)
  const parsed = JSON.parse(source)
  const schema = new SchemaToMarkdown(argv[2], parsed)
  process.stdout.write(schema.toMd())
  process.stdout.write(
    `\n\n---\n\n*Rendered by [Fadroma](https://fadroma.tech) (${link}) ` +
    `from \`${basename(input)}\` (\`${hash}\`)*`
  )
} else {
  // Shorten paths for usage
  const paths = (env.PATH||'').split(':')
  if (paths.includes(dirname(argv[0]))) {
    argv[0] = basename(argv[0])
  } else {
    const resolvedPaths = paths
      .map(path=>resolve(path, basename(argv[0])))
      .filter(path=>existsSync(path))
      .map(path=>realpathSync(path))
    if (resolvedPaths.includes(argv[0])) {
      argv[0] = basename(argv[0])
    }
  }
  argv[1] = relative(cwd(), argv[1])
  // Print usage
  process.stderr.write([
    `Fadroma Schema Renderer (https://fadroma.tech)`,
    `Usage:`,
    `  ${process.argv.join(' ')} CONTRACT_SCHEMA.json`,
    ''
  ].join('\n'))
  process.exit(1)
}
