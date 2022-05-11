import { resolve, dirname, basename, relative } from 'path'
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { cwd } from 'process'
import rimraf from 'rimraf'
import mkdirp from 'mkdirp'

export function touch (...fragments) {
  const path = resolve(...fragments)
  if (!existsSync(path)) console.info('Creating file:', path)
  writeFileSync(path, '')
  return path
}

export class Path {
  constructor (...fragments) {
    this.path = resolve(...fragments)
  }
  resolve (name) {
    if (name.includes('/')) throw new Error(`invalid name: ${name}`)
    return resolve(this.path, basename(name))
  }
  get name () {
    return basename(this.path)
  }
  get parent () {
    return dirname(this.path)
  }
  get shortPath () {
    return relative(cwd(), this.path)
  }
  get exists () {
    return existsSync(this.path)
  }
  assert () {
    if (!this.exists) throw new Error(`${this.path} does not exist`)
    return this
  }
  delete () {
    rimraf.sync(this.path)
    return this
  }
  make () {
    throw new Error("@hackbg/kabinet: file or directory? use subclass")
  }
  in (...fragments) {
    const sub = new this.constructor(this.path, ...fragments)
    if (sub.exists && sub.isFile) {
      throw new Error(`@hackbg/kabinet: cannot use .in() to descend under existing file: ${sub.path}`)
    }
    return sub.asDir()
  }
  get isDir () {
    return statSync(this.path).isDirectory()
  }
  asDir (Ctor = Directory) {
    return new Ctor(this.path)
  }
  at (...fragments) {
    const sub = new this.constructor(this.path, ...fragments)
    if (sub.exists && sub.isDir) {
      throw new Error(`@hackbg/kabinet: Path#at: cannot use .at() to point to directory: ${sub.path}`)
    }
    return sub.asFile()
  }
  get isFile () {
    return statSync(this.path).isFile()
  }
  asFile (Ctor = File) {
    return new Ctor(this.path)
  }
}

export class File extends Path {
  as (Format) {
    return new Format.File(this.path)
  }
  make () {
    mkdirp.sync(dirname(this.path))
    touch(this.path)
    return this
  }
}

export class BinaryFile extends File {
  load () {
    return readFileSync(this.path)
  }
  save (data) {
    writeFileSync(this.path, data)
    return this
  }
}

export class TextFile extends File {
  load () {
    return readFileSync(this.path, 'utf8')
  }
  save (data) {
    this.make()
    writeFileSync(this.path, data, 'utf8')
    return this
  }
}

export class Directory extends Path {
  as (Format) {
    return new Format.Directory(this.path)
  }
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
    return new File(this.path, ...fragments)
  }
}
