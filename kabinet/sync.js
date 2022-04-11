import { resolve, dirname, basename } from 'path'
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import rimraf from 'rimraf'
import mkdirp from 'mkdirp'

export function touch (...fragments) {
  const path = resolve(...fragments)
  if (!existsSync(path)) console.info('Creating file:', path)
  writeFileSync(path, '')
  return path
}

export class FSCRUD {
  constructor (...fragments) {
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
  make () { throw null }
}

export class File extends FSCRUD {
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

export class Directory extends FSCRUD {
  make () {
    mkdirp.sync(this.path)
    return this
  }
  resolve (name) {
    if (name.includes('/')) throw new Error(`invalid name: ${name}`)
    return resolve(this.path, basename(name))
  }
  list () {
    if (!this.exists()) return []
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
    if (!this.exists()) return []
    return readdirSync(this.path).filter(x=>statSync(this.resolve(x)).isDirectory())
  }
  subdir (name, Dir = Directory) {
    return new Dir(this.path, name)
  }
  file (File = TextFile, ...fragments) {
    return new File(this.path, ...fragments)
  }
}
