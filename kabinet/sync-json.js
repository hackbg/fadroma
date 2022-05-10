import { existsSync } from 'fs'
import { basename } from 'path'

import { TextFile, Directory } from './sync.js'

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
  static extension = '.json'
  has (name) {
    return existsSync(this.resolve(`${name}${JSONDirectory.extension}`))
  }
  list () {
    const matchExtension = x => x.endsWith(JSONDirectory.extension)
    const stripExtension = x => basename(x, JSONDirectory.extension)
    return super.list().filter(matchExtension).map(stripExtension)
  }
  load (name) {
    name = `${name}.${this.constructor.extension}`
    try {
      return JSON.parse(super.load(name))
    } catch (e) {
      throw new Error(`failed to load ${name}: ${e.message}`)
    }
  }
  save (name, data) {
    data = JSON.stringify(data, null, 2)
    super.save(`${name}${JSONDirectory.extension}`, data)
    return this
  }
}
