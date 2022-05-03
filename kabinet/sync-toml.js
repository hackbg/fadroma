import { existsSync } from 'fs'
import { basename } from 'path'

import { TextFile, Directory } from './sync'

export class TOMLFile extends TextFile {
  load () {
    return TOML.parse(super.load())
  }
  save (data) {
    super.save(TOML.stringify(data, null, 2))
    return this
  }
}

export class TOMLDirectory extends Directory {
  static extension = '.toml'
  has (name) {
    return existsSync(this.resolve(`${name}${TOMLDirectory.extension}`))
  }
  list () {
    const matchExtension = x => x.endsWith(TOMLDirectory.extension)
    const stripExtension = x => basename(x, TOMLDirectory.extension)
    return super.list().filter(matchExtension).map(stripExtension)
  }
  load (name) {
    name = `${name}.${TOMLDirectory.extension}`
    try {
      return TOML.parse(super.load(name))
    } catch (e) {
      throw new Error(`failed to load ${name}: ${e.message}`)
    }
  }
  save (name, data) {
    data = TOML.stringify(data, null, 2)
    super.save(`${name}${TOMLDirectory.extension}`, data)
    return this
  }
}
