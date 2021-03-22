import { readFileSync } from 'fs'

const loadSchemas = (base, schemas = {}) =>
  Object.entries(schemas).reduce((output, [name, path])=>
    Object.assign(output, {
      [name]: loadJSON(path, base)
    }), {})

const loadJSON = (path, base) =>
  JSON.parse(
    base ? readFileSync(new URL(path, base))
         : readFileSync(path))

export { loadJSON, loadSchemas }
