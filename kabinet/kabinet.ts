import { resolve, dirname } from 'path'
import { existsSync } from 'fs'
import _rimraf from 'rimraf'
import { fileURLToPath } from 'url'

import mkdirp from 'mkdirp'
import symlinkDir from 'symlink-dir'
import tmp from 'tmp'
import copy from 'recursive-copy'

import { Console } from '@hackbg/konzola'
const console = Console('@hackbg/kabinet')

export function getDirName (url) {
  return dirname(fileURLToPath(url))
}

// shorthands
export function mkdir (...fragments: string[]) {
  const path = resolve(...fragments)
  if (!existsSync(path)) console.info('Creating directory:', path)
  mkdirp.sync(path, {mode: 0o770})
  return path
}

export function rimraf (path = "") {
  return new Promise((resolve, reject)=>_rimraf(path, (err) =>
    err ? reject(err) : resolve(path))
  )
}

export function withTmpDir <T> (fn: (path: string)=>T): T {
  const {name} = tmp.dirSync()
  try { return fn(name) } finally { rimraf(name) }
}

export function withTmpFile <T> (fn: (path: string)=>T): T {
  const {name} = tmp.fileSync()
  try { return fn(name) } finally { rimraf(name) }
}

// originals
export * from './sync'
export * from './sync-json'
export * from './sync-toml'
export * from './sync-yaml'

// reexports
export { mkdirp, symlinkDir, tmp, copy }
export { homedir } from 'os'
export { resolve, relative, dirname, basename, extname } from 'path'
export { fileURLToPath } from 'url'
export { cwd } from 'process'
