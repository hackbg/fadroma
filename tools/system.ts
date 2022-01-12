import open from 'open'
export { open }

export { cwd, stderr, env } from 'process'

import onExit from 'signal-exit'
export { onExit }

export { execFile, execFileSync, spawn, spawnSync } from 'child_process'

export { homedir } from 'os'

export { resolve, relative, dirname, basename, extname } from 'path'
import { resolve, dirname, basename } from 'path'

export { fileURLToPath } from 'url'
import { fileURLToPath } from 'url'

export { existsSync, unlinkSync, readFileSync, writeFileSync, readdirSync, statSync, readlinkSync } from 'fs'
import { existsSync, readFileSync, writeFileSync, statSync, readdirSync } from 'fs'
export { readFile, writeFile, stat, unlink } from 'fs/promises'

import mkdirp from 'mkdirp'
export { mkdirp }

import symlinkDir from 'symlink-dir'
export { symlinkDir }

import tmp from 'tmp'
export { tmp }

import copy from 'recursive-copy'
export { copy }

import { Console } from './cli'
const console = Console(import.meta.url)

// class-based atomic fs handles ///////////////////////////////////////////////////////////////////

export * from '@hackbg/kabinet'

// fs functions ////////////////////////////////////////////////////////////////////////////////////

export const mkdir = (...fragments: Array<string>) => {
  const path = resolve(...fragments)
  if (!existsSync(path)) console.info('Creating directory:', path)
  mkdirp.sync(path, {mode: 0o770})
  return path }

export const makeStateDir = (path: string, ...subdirs: Array<string>) => {
  // somewhere to store localnet state,
  // as well as upload receipts for all networks:
  if (path.startsWith('file://')) path = fileURLToPath(path)
  if (existsSync(path) && (statSync(path)).isFile()) path = dirname(path)
  return mkdir(path, ...subdirs) }

import _rimraf from 'rimraf'
export const rimraf = (path: string) =>
  new Promise<void>((resolve, reject)=>{
    _rimraf(path, (err) => { if (err) { reject(err) } else { resolve() } }) })

// misc data functions /////////////////////////////////////////////////////////////////////////////

import { randomBytes } from 'crypto'
export const randomHex = (bytes: number) =>
  randomBytes(bytes).toString("hex")
export const randomBase64 = (bytes: number) =>
  randomBytes(bytes).toString("base64")

import { TextDecoder } from 'util'
const decoder = new TextDecoder();
export const decode = (buffer: Buffer) => decoder.decode(buffer).trim()

import { URL } from 'url'
export const loadJSON = (path: string, base?: string) =>
  JSON.parse(String(
    base ? readFileSync(new URL(path, base))
         : readFileSync(path)))

export const timestamp = (d = new Date()) =>
  d.toISOString()
    .replace(/[-:\.Z]/g, '')
    .replace(/[T]/g, '_')
    .slice(0, -3)
