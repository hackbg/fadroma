import copy from 'recursive-copy'
import mkdirp from 'mkdirp'
import rimrafCb from 'rimraf'
import symlinkDir from 'symlink-dir'
import tmp from 'tmp'
import { cwd } from 'process'
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { fileURLToPath } from 'url'
import { resolve, dirname, basename, extname, relative } from 'path'
import { homedir } from 'os'

const rimrafSync = rimrafCb.sync

import TOML from 'toml'
import YAML from 'js-yaml'

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
  return new Promise((resolve, reject)=>rimrafCb(path, (err) =>
    err ? reject(err) : resolve(path))
  )
}

export function withTmpDir <T> (fn: (path: string)=>T): T {
  const {name} = tmp.dirSync()
  try { return fn(name) } finally { rimrafSync(name) }
}

export function withTmpFile <T> (fn: (path: string)=>T): T {
  const {name} = tmp.fileSync()
  try { return fn(name) } finally { rimrafSync(name) }
}

export function touch (...fragments) {
  const path = resolve(...fragments)
  if (!existsSync(path)) console.info('Creating file:', path)
  writeFileSync(path, '')
  return path
}

export class Path {

  constructor (base: string|URL|Path, ...fragments: string[]) {
    if (base instanceof Path) {
      base = base.path
    }
    if (base instanceof URL || base.startsWith('file://')) {
      base = fileURLToPath(base)
    }
    this.path = resolve(base, ...fragments)
  }

  path: string

  resolve (name): string {
    if (name.includes('/')) throw new Error(`invalid name: ${name}`)
    return resolve(this.path, basename(name))
  }

  get name (): string {
    return basename(this.path)
  }

  get parent (): string {
    return dirname(this.path)
  }

  get shortPath (): string {
    return relative(cwd(), this.path)
  }

  get exists (): boolean {
    return existsSync(this.path)
  }

  get isDir (): boolean {
    return this.exists && statSync(this.path).isDirectory()
  }

  get isFile (): boolean {
    return this.exists && statSync(this.path).isFile()
  }

  assert (): this {
    if (!this.exists) throw new Error(`${this.path} does not exist`)
    return this
  }

  delete (): this {
    rimrafSync(this.path)
    return this
  }

  makeParent (): this {
    mkdirp.sync(dirname(this.path))
    return this
  }

  make (): this {
    throw new Error("@hackbg/kabinet: file or directory? use subclass")
  }

  at (...fragments: string[]): Path {
    const sub = new (this.constructor as PathCtor<typeof this>)(this.path, ...fragments)
    if (sub.isDir) {
      throw new Error(`@hackbg/kabinet: Path#at: use .in() to descend into directory: ${sub.path}`)
    }
    return sub
  }

  in (...fragments: string[]): Path {
    const sub = new (this.constructor as PathCtor<typeof this>)(this.path, ...fragments)
    if (sub.isFile) {
      throw new Error(`@hackbg/kabinet: use .at() to point to file: ${sub.path}`)
    }
    return sub
  }

  as <T, U extends BaseFile<T>|Directory> (Ctor: PathCtor<U>): U {
    return new Ctor(this.path)
  }

}

export interface PathCtor <P> {
  new (...fragments: string[]): P
}

export abstract class BaseFile<T> extends Path {
  make () {
    this.makeParent()
    touch(this.path)
    return this
  }
  abstract load (): T
  abstract save (data: T): this
}

export class OpaqueFile extends BaseFile<never> {
  load (): never {
    throw new Error("OpaqueFile: not meant to be loaded")
  }
  save (data): never {
    throw new Error("OpaqueFile: not meant to be saved")
  }
}

export class BinaryFile extends BaseFile<Buffer> {
  load () { return readFileSync(this.path) }
  save (data): this {
    this.makeParent()
    writeFileSync(this.path, data)
    return this
  }
}

export class TextFile extends BaseFile<string> {
  load () { return readFileSync(this.path, 'utf8') }
  save (data) {
    this.makeParent()
    writeFileSync(this.path, data, 'utf8')
    return this
  }
}

export class JSONFile<T> extends BaseFile<T> {
  static extension = '.json'
  load () { return JSON.parse(readFileSync(this.path, 'utf8')) as T }
  save (data) {
    this.makeParent()
    writeFileSync(this.path, JSON.stringify(data, null, 2), 'utf8')
    return this
  }
}

export class YAMLFile<T> extends BaseFile<T> {
  static extension = '.yaml'
  load () { return YAML.parse(readFileSync(this.path, 'utf8')) as T }
  save (data) {
    this.makeParent()
    writeFileSync(this.path, YAML.dump(data, null, 2), 'utf8')
    return this
  }
}

export class TOMLFile<T> extends BaseFile<T> {
  static extension = '.toml'
  load () { return TOML.parse(readFileSync(this.path, 'utf8')) as T }
  save (data: any) {
    throw new Error('TOML serialization not supported')
    return this
  }
}

export class Directory<T> extends Path {

  get File (): typeof BaseFile<T> { return OpaqueFile }S

  make () {
    mkdirp.sync(this.path)
    return this
  }

  list () {
    if (!this.exists) return []
    return readdirSync(this.path)
  }

  has (name) {
    return existsSync(this.resolve(name))
  }

  load (name) {
    return readFileSync(this.resolve(name), 'utf8')
  }

  save (name, data) {
    this.make()
    writeFileSync(this.resolve(name), data, 'utf8')
    return this
  }

  subdirs () {
    if (!this.exists) return []
    return readdirSync(this.path).filter(x=>statSync(this.resolve(x)).isDirectory())
  }

  subdir (name) {
    return new Directory(this.path, name)
  }
  
  file (...fragments) {
    return new this.File(this.path, ...fragments)
  }

}

export class JSONDirectory<T> extends Directory<T> {

  get File () { return JSONFile }

  has (name) {
    return existsSync(this.resolve(`${name}${JSONFile.extension}`))
  }

  list () {
    const matchExtension = x => x.endsWith(JSONFile.extension)
    const stripExtension = x => basename(x, JSONFile.extension)
    return super.list().filter(matchExtension).map(stripExtension)
  }

  load (name) {
    name = `${name}${JSONFile.extension}`
    try {
      return JSON.parse(super.load(name))
    } catch (e) {
      throw new Error(`failed to load ${name}: ${e.message}`)
    }
  }

  save (name, data) {
    data = JSON.stringify(data, null, 2)
    super.save(`${name}${JSONFile.extension}`, data)
    return this
  }

}

export class YAMLDirectory<T> extends Directory<T> {

  get File () { return YAMLFile }

  has (name) {
    return existsSync(this.resolve(`${name}${YAMLFile.extension}`))
  }
  list () {
    const matchExtension = x => x.endsWith(YAMLFile.extension)
    const stripExtension = x => basename(x, YAMLFile.extension)
    return super.list().filter(matchExtension).map(stripExtension)
  }
  load (name) {
    name = `${name}${YAMLFile.extension}`
    try {
      return YAML.parse(super.load(name))
    } catch (e) {
      throw new Error(`failed to load ${name}: ${e.message}`)
    }
  }
  save (name, data) {
    data = YAML.dump(data, null, 2)
    super.save(`${name}${YAMLFile.extension}`, data)
    return this
  }
}

export class TOMLDirectory<T> extends Directory<T> {

  get File () { return TOMLFile }

  has (name) {
    return existsSync(this.resolve(`${name}${TOMLFile.extension}`))
  }

  list () {
    const matchExtension = x => x.endsWith(TOMLFile.extension)
    const stripExtension = x => basename(x, TOMLFile.extension)
    return super.list().filter(matchExtension).map(stripExtension)
  }

  load (name) {
    name = `${name}${TOMLFile.extension}`
    try {
      return TOML.parse(super.load(name))
    } catch (e) {
      throw new Error(`failed to load ${name}: ${e.message}`)
    }
  }

  save (name, data) {
    throw new Error('TOML serialization not supported')
    return this
  }

}

// reexports
export {
  basename,
  copy,
  cwd,
  dirname,
  extname,
  fileURLToPath,
  mkdirp,
  relative,
  resolve,
  symlinkDir,
  tmp
}

export default Path
