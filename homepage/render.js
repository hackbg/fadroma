import { readFileSync, writeFileSync } from 'fs'
import { compileFile } from 'pug'
import { loadAll } from 'js-yaml'
const template = compileFile(`./homepage/index.pug`, { self: true })
const output   = `./docs/index.html`
const locals   = {}
locals.features = loadAll(readFileSync('./homepage/features.yaml'))
writeFileSync(output, template(locals))
