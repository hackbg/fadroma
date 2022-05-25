import { existsSync } from 'fs'
import { basename } from 'path'
import TOML from 'toml'
import { TextFile, Directory } from './sync.js'

export class TOMLFile extends TextFile {
  load () {
    return TOML.parse(super.load())
  }
  save (data) {
    throw new Error('TOML serialization not supported')
    return this
  }
}

export class TOMLDirectory extends Directory {
  has (name) {
    return existsSync(this.resolve(`${name}${TOMLFormat.extension}`))
  }
  list () {
    const matchExtension = x => x.endsWith(TOMLFormat.extension)
    const stripExtension = x => basename(x, TOMLFormat.extension)
    return super.list().filter(matchExtension).map(stripExtension)
  }
  load (name) {
    name = `${name}${TOMLFormat.extension}`
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

export class TOMLFormat {
  static extension = '.toml'
  static File = TOMLFile
  static Dir  = TOMLDirectory
}
