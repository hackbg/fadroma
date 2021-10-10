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

// class-based atomic fs handles ///////////////////////////////////////////////////////////////////

export type Path = string

export abstract class FSCRUD {
  readonly path: Path
  constructor (...fragments: Array<Path>) {
    this.path = resolve(...fragments) }
  exists () {
    return existsSync(this.path) }
  assert () {
    if (!this.exists()) throw new Error(`${this.path} does not exist`)
    return this }
  delete () {
    _rimraf.sync(this.path)
    return this }
  abstract make (): void }

abstract class File extends FSCRUD {
  make () {
    mkdirp.sync(dirname(this.path))
    touch(this.path)
    return this } }

export class BinaryFile extends File {
  load () {
    return readFileSync(this.path) }
  save (data: any) {
    writeFileSync(this.path, data)
    return this } }

export class TextFile extends File {
  load () {
    return readFileSync(this.path, 'utf8') }
  save (data: any) {
    this.make()
    writeFileSync(this.path, data, 'utf8')
    return this } }

export class JSONFile extends TextFile {
  load () {
    return JSON.parse(super.load()) }
  save (data: any) {
    super.save(JSON.stringify(data, null, 2))
    return this } }

export class Directory extends FSCRUD {
  make () {
    mkdirp.sync(this.path)
    return this }
  resolve (name: Path) {
    if (name.includes('/')) throw new Error(`invalid name: ${name}`)
    return resolve(this.path, basename(name)) }
  list () {
    if (!this.exists()) return []
    return readdirSync(this.path) }
  has  (name: Path) {
    return existsSync(this.resolve(name)) }
  load (name: Path) {
    return readFileSync(this.resolve(name), 'utf8') }
  save (name: Path, data: any) {
    this.make()
    writeFileSync(this.resolve(name), data, 'utf8')
    return this }
  subdirs () {
    if (!this.exists()) return []
    return readdirSync(this.path).filter(x=>statSync(this.resolve(x)).isDirectory()) }
  subdir (name: string, Dir: typeof Directory = Directory) {
    return new Dir(this.path, name) } }

export class JSONDirectory extends Directory {
  has (name: Path) {
    return existsSync(this.resolve(`${name}.json`)) }
  list () {
    return super.list().filter(x=>x.endsWith('.json')).map(x=>basename(x, '.json')) }
  load (name: Path) {
    return JSON.parse(super.load(`${name}.json`)) }
  save (name: Path, data: any) {
    super.save(`${name}.json`, JSON.stringify(data, null, 2))
    return this } }

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
    _rimraf(path, (err) => { if (err) { reject(err) } else { resolve() } }) })

import { randomBytes } from 'crypto'
export const randomHex = (bytes: number) =>
  randomBytes(bytes).toString("hex")
export const randomBase64 = (bytes: number) =>
  randomBytes(bytes).toString("base64")

const decoder = new TextDecoder();
export const decode = (buffer: Buffer) => decoder.decode(buffer).trim()

export const loadJSON = (path: string, base?: string) =>
  JSON.parse(String(
    base ? readFileSync(new URL(path, base))
         : readFileSync(path)))

export const timestamp = (d = new Date()) =>
  d.toISOString()
    .replace(/[-:\.Z]/g, '')
    .replace(/[T]/g, '_')
    .slice(0, -3)
