#!/usr/bin/env node
import {argv, env, cwd} from 'node:process'
import {dirname, basename, resolve, relative} from 'node:path'
import {existsSync, realpathSync, readFileSync} from 'node:fs'
import {SchemaToMarkdown} from './schema.mjs'

if (argv.length > 2) {
  process.stderr.write(`Converting schema: ${argv[2]}\n`)
  const source = readFileSync(argv[2], 'utf8')
  const parsed = JSON.parse(source)
  const schema = new SchemaToMarkdown(argv[2], parsed)
  process.stdout.write(schema.toMd())
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
