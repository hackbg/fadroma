import { existsSync } from 'fs'
import { basename } from 'path'

import { TextFile, Directory } from './sync'

export class JSONFile extends TextFile {
  load () {
    return JSON.parse(super.load())
  }
  save (data) {
    super.save(JSON.stringify(data, null, 2))
    return this
  }
}

export class JSONDirectory extends Directory {
  File = JSONFile

  has (name) {
    return existsSync(this.resolve(`${name}${JSONFormat.extension}`))
  }
  list () {
    const matchExtension = x => x.endsWith(JSONFormat.extension)
    const stripExtension = x => basename(x, JSONFormat.extension)
    return super.list().filter(matchExtension).map(stripExtension)
  }
  load (name) {
    name = `${name}${JSONFormat.extension}`
    try {
      return JSON.parse(super.load(name))
    } catch (e) {
      throw new Error(`failed to load ${name}: ${e.message}`)
    }
  }
  save (name, data) {
    data = JSON.stringify(data, null, 2)
    super.save(`${name}${JSONFormat.extension}`, data)
    return this
  }
}

export class JSONFormat {
  static extension = '.json'
  static File = JSONFile
  static Dir  = JSONDirectory
}
