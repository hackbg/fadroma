import { resolve, dirname, basename, relative } from 'path'
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { cwd } from 'process'
import rimraf from 'rimraf'
import mkdirp from 'mkdirp'
import { fileURLToPath } from 'url'

export function touch (...fragments) {
  const path = resolve(...fragments)
  if (!existsSync(path)) console.info('Creating file:', path)
  writeFileSync(path, '')
  return path
}

export interface PathCtor <P> {
  new (...fragments: string[]): P
}

export class Path {

  constructor (...fragments: string[]) {
    if (
      fragments[0] as any instanceof URL ||
      fragments[0].startsWith('file://')
    ) {
      fragments[0] = fileURLToPath(fragments[0])
    }
    this.path = resolve(...fragments)
  }

  readonly path: string

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
    return statSync(this.path).isDirectory()
  }

  get isFile (): boolean {
    return statSync(this.path).isFile()
  }

  assert (): this {
    if (!this.exists) throw new Error(`${this.path} does not exist`)
    return this
  }

  delete (): this {
    rimraf.sync(this.path)
    return this
  }

  make (): this {
    throw new Error("@hackbg/kabinet: file or directory? use subclass")
  }

  asDir <D extends Directory> (Ctor: PathCtor<unknown> = Directory): D {
    return new (Ctor as PathCtor<D>)(this.path)
  }

  /** Default File subclass, e.g. JSONFile in JSONDirectory */
  File = File

  asFile <F extends File> (Ctor: PathCtor<unknown> = this.File): F {
    return new (Ctor as PathCtor<F>)(this.path)
  }

  at (...fragments: string[]) {
    const sub = new (this.constructor as PathCtor<typeof this>)(this.path, ...fragments)
    if (sub.exists && sub.isDir) {
      throw new Error(`@hackbg/kabinet: Path#at: cannot use .at() to point to directory: ${sub.path}`)
    }
    return sub.asFile()
  }

  in (...fragments: string[]): Directory {
    const sub = new (this.constructor as PathCtor<typeof this>)(this.path, ...fragments)
    if (sub.exists && sub.isFile) {
      throw new Error(`@hackbg/kabinet: cannot use .in() to descend under existing file: ${sub.path}`)
    }
    return sub.asDir()
  }

}

export class File extends Path {
  as (Format) {
    if (Format.File) {
      return new Format.File(this.path)
    } else {
      return new Format(this.path)
    }
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
    if (Format.Dir) {
      return new Format.Dir(this.path)
    } else {
      return new Format(this.path)
    }
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
