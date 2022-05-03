import { Console } from '@hackbg/konzola'
const console = Console('@hackbg/kabinet')

import mkdirp from 'mkdirp'
import symlinkDir from 'symlink-dir'
import tmp from 'tmp'
import copy from 'recursive-copy'

// reexports
export { mkdirp, symlinkDir, tmp, copy }
export { homedir } from 'os'
export { resolve, relative, dirname, basename, extname } from 'path'
export { fileURLToPath } from 'url'
export { cwd } from 'process'

// shorthands
export const mkdir = (...fragments) => {
  const path = resolve(...fragments)
  if (!existsSync(path)) console.info('Creating directory:', path)
  mkdirp.sync(path, {mode: 0o770})
  return path
}

import _rimraf from 'rimraf'
export const rimraf = (path = "") =>
  new Promise((resolve, reject)=>
    _rimraf(path, (err) => err ? reject(err) : resolve(path)))

export const withTmpDir = fn => {
  const {name} = tmp.dirSync()
  try { return fn(name) } finally { rimraf(name) }
}

export const withTmpFile = fn => {
  const {name} = tmp.fileSync()
  try { return fn(name) } finally { rimraf(name) }
}

// originals
export * from './sync'
export * from './sync-json'
