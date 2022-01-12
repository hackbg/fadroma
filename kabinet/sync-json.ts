import { existsSync } from 'fs'
import { basename } from 'path'

import type { Path } from './sync'
import { TextFile, Directory } from './sync'

export class JSONFile extends TextFile {
  load () {
    return JSON.parse(super.load())
  }
  save (data: any) {
    super.save(JSON.stringify(data, null, 2))
    return this
  }
}

export class JSONDirectory extends Directory {
  static extension = '.json'
  has (name: Path) {
    return existsSync(this.resolve(`${name}${JSONDirectory.extension}`))
  }
  list () {
    const matchExtension = (x:string)=>x.endsWith(JSONDirectory.extension)
    const stripExtension = (x:string) =>basename(x, JSONDirectory.extension)
    return super.list().filter(matchExtension).map(stripExtension)
  }
  load (name: Path) {
    name = `${name}.json`
    try {
      return JSON.parse(super.load(name))
    } catch (e) {
      throw new Error(`failed to load ${name}: ${e.message}`)
    }
  }
  save (name: Path, data: any) {
    data = JSON.stringify(data, null, 2)
    super.save(`${name}${JSONDirectory.extension}`, data)
    return this
  }
}
