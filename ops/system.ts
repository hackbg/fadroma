import open from 'open'
export { open }

export { cwd, stderr, env } from 'process'
import { cwd } from 'process'

import onExit from 'signal-exit'
export { onExit }

export { execFile, execFileSync, spawn, spawnSync } from 'child_process'

export { homedir } from 'os'

export { resolve, relative, dirname, basename, extname } from 'path'
import { resolve, dirname } from 'path'

export { fileURLToPath } from 'url'
import { fileURLToPath } from 'url'

export { existsSync, unlinkSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { existsSync, readFileSync, writeFileSync, statSync, readdirSync } from 'fs'
export { readFile, writeFile, stat, unlink } from 'fs/promises'

import mkdirp from 'mkdirp'
export { mkdirp }

// class-based atomic fs handles ///////////////////////////////////////////////////////////////////

export type Path = string

export abstract class FSCRUD {
  readonly path: Path
  constructor (...fragments: Array<Path>) { this.path = resolve(...fragments) }
  exists () { return existsSync(this.path) }
  assert () { if (!this.exists()) throw new Error(`${this.path} does not exist`) }
  delete () { _rimraf.sync(this.path) }
  abstract make (): void }

export class TextFile extends FSCRUD {
  make () { touch(this.path) }
  load () { return readFileSync(this.path, 'utf8') }
  save (data: any) { writeFileSync(this.path, data) } }

export class JSONFile extends TextFile {
  load () { return JSON.parse(super.load()) }
  save (data: any) { super.save(JSON.stringify(data, null, 2)) } }

export class Directory extends FSCRUD {
  make () { mkdirp.sync(this.path) }
  protected resolve (name: Path) {
    if (name.startsWith('.')||name.includes('/')) { throw new Error(`invalid name: ${name}`) }
    return resolve(this.path, name) }
  list () { return readdirSync(this.path) }
  load (name: Path) { return readFileSync(this.resolve(name), 'utf8') }
  save (name: Path, data: any) { writeFileSync(this.resolve(name), data, 'utf8') } }

export class JSONDirectory extends Directory {
  load (name: Path) { return JSON.parse(super.load(`${name}.json`)) }
  save (name: Path, data: any) {
    if (name.includes('/')) throw new Error(`invalid name: ${name}`)
    writeFileSync(resolve(this.path, name), data, 'utf8') } }

// fs functions ////////////////////////////////////////////////////////////////////////////////////

export const mkdir = (...fragments: Array<string>) => {
  const path = resolve(...fragments)
  if (!existsSync(path)) console.debug('📁 creating:', path)
  mkdirp.sync(path, {mode: 0o770})
  return path }

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
