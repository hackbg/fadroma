import { existsSync } from 'fs'
import { basename } from 'path'
import _TOML from 'toml'
import { TextFile, Directory } from './sync.js'

export class TOMLFile extends TextFile {
  load () {
    const data = super.load()
    return _TOML.parse(data)
  }
  save (data) {
    super.save(TOML.stringify(data, null, 2))
    return this
  }
}

export class TOMLDirectory extends Directory {
  has (name) {
    return existsSync(this.resolve(`${name}${TOML.extension}`))
  }
  list () {
    const matchExtension = x => x.endsWith(TOML.extension)
    const stripExtension = x => basename(x, TOML.extension)
    return super.list().filter(matchExtension).map(stripExtension)
  }
  load (name) {
    name = `${name}${TOML.extension}`
    try {
      return TOML.parse(super.load(name))
    } catch (e) {
      throw new Error(`failed to load ${name}: ${e.message}`)
    }
  }
  save (name, data) {
    data = TOML.stringify(data, null, 2)
    super.save(`${name}${TOML.extension}`, data)
    return this
  }
}

export class TOML {
  static extension = '.toml'
  static File = TOMLFile
  static Dir  = TOMLDirectory
}
