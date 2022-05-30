import { existsSync } from 'fs'
import { basename } from 'path'
import YAML from 'js-yaml'
import { TextFile, Directory } from './sync'

export class YAMLFile extends TextFile {
  load () {
    return YAML.parse(super.load())
  }
  save (data) {
    super.save(YAML.stringify(data, null, 2))
    return this
  }
}

export class YAMLDirectory extends Directory {
  File = YAMLFile

  has (name) {
    return existsSync(this.resolve(`${name}${YAMLFormat.extension}`))
  }
  list () {
    const matchExtension = x => x.endsWith(YAMLFormat.extension)
    const stripExtension = x => basename(x, YAMLFormat.extension)
    return super.list().filter(matchExtension).map(stripExtension)
  }
  load (name) {
    name = `${name}${YAMLFormat.extension}`
    try {
      return YAML.parse(super.load(name))
    } catch (e) {
      throw new Error(`failed to load ${name}: ${e.message}`)
    }
  }
  save (name, data) {
    data = YAML.dump(data, null, 2)
    super.save(`${name}${YAMLFormat.extension}`, data)
    return this
  }
}

export class YAMLFormat {
  static extension = '.yaml'
  static File = YAMLFile
  static Dir  = YAMLDirectory
}
