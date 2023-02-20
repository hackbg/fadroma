import { readFileSync, writeFileSync } from 'fs'
import { compileFile } from 'pug'
import { loadAll } from 'js-yaml'
const template = compileFile(`./homepage/index.pug`, { self: true })
writeFileSync(
  `./homepage/index.html`,
  template({ features: loadAll(readFileSync('./homepage/features.yaml')) })
)
