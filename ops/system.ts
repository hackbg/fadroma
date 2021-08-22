export { cwd, stderr } from 'process'
import { cwd } from 'process'

import onExit from 'signal-exit'
export { onExit }

export { execFileSync, spawnSync } from 'child_process'

export { homedir } from 'os'

export { resolve, relative, dirname, basename, extname } from 'path'
import { resolve, dirname } from 'path'

export { fileURLToPath } from 'url'
import { fileURLToPath } from 'url'

export { existsSync, unlinkSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { existsSync, readFileSync, writeFileSync, statSync } from 'fs'
export { readFile, writeFile, stat, unlink } from 'fs/promises'

import mkdirp from 'mkdirp'
export { mkdirp }

export const mkdir = (...fragments: Array<string>) => {
  const path = resolve(...fragments)
  if (!existsSync(path)) console.debug('📁 creating:', path)
  mkdirp.sync(path, {mode: 0o770})
  return path }

export const defaultDataDir = () =>
  cwd()

export const makeStateDir = (path: string, ...subdirs: Array<string>) => {
  // somewhere to store localnet state,
  // as well as upload receipts for all networks:
  if (path.startsWith('file://')) path = fileURLToPath(path)
  if (existsSync(path) && (statSync(path)).isFile()) path = dirname(path)
  return mkdir(path, ...subdirs) }

export const touch = (...fragments: Array<string>) => {
  const path = resolve(...fragments)
  if (!existsSync(path)) console.debug('🧾 creating:', path)
  writeFileSync(path, '')
  return path }

import _rimraf from 'rimraf'
export const rimraf = (path: string) =>
  new Promise<void>((resolve, reject)=>{
    _rimraf(path, (err) => {
      if (err) {
        reject(err) }
      else {
        resolve() } }) })

import { randomBytes } from 'crypto'
export const randomHex = (bytes: number) => randomBytes(bytes).toString("hex")

const decoder = new TextDecoder();
export const decode = (buffer: Buffer) => decoder.decode(buffer).trim()

export const loadJSON = (path: string, base?: string) =>
  JSON.parse(String(
    base ? readFileSync(new URL(path, base))
         : readFileSync(path)))
