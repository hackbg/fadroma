import { resolve, dirname, basename } from 'path'
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import * as rimraf from 'rimraf'
import * as mkdirp from 'mkdirp'

export type Path = string

export function touch (...fragments: Array<string>) {
  const path = resolve(...fragments)
  if (!existsSync(path)) console.info('Creating file:', path)
  writeFileSync(path, '')
  return path
}

export abstract class FSCRUD {
  readonly path: Path
  constructor (...fragments: Array<Path>) {
    this.path = resolve(...fragments)
  }
  exists () {
    return existsSync(this.path)
  }
  assert () {
    if (!this.exists()) throw new Error(`${this.path} does not exist`)
    return this
  }
  delete () {
    rimraf.sync(this.path)
    return this
  }
  abstract make (): void
}

export abstract class File extends FSCRUD {
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
  save (data: any) {
    writeFileSync(this.path, data)
    return this
  }
}

export class TextFile extends File {
  load () {
    return readFileSync(this.path, 'utf8')
  }
  save (data: any) {
    this.make()
    writeFileSync(this.path, data, 'utf8')
    return this
  }
}

export class Directory extends FSCRUD {
  make () {
    mkdirp.sync(this.path)
    return this
  }
  resolve (name: Path) {
    if (name.includes('/')) throw new Error(`invalid name: ${name}`)
    return resolve(this.path, basename(name))
  }
  list () {
    if (!this.exists()) return []
    return readdirSync(this.path)
  }
  has (name: Path) {
    return existsSync(this.resolve(name))
  }
  load (name: Path) {
    return readFileSync(this.resolve(name), 'utf8')
  }
  save (name: Path, data: any) {
    this.make()
    writeFileSync(this.resolve(name), data, 'utf8')
    return this
  }
  subdirs () {
    if (!this.exists()) return []
    return readdirSync(this.path).filter(x=>statSync(this.resolve(x)).isDirectory())
  }
  subdir (name: string, Dir: typeof Directory = Directory) {
    return new Dir(this.path, name)
  }
  file (
    F: new(...fragments:Path[])=>File = TextFile,
    ...fragments: Array<Path>
  ) {
    return new F(...fragments)
  }
}
