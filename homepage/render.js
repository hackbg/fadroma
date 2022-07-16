import { readFileSync, writeFileSync } from 'fs'
import { compileFile } from 'pug'
import { loadAll } from 'js-yaml'
const template = compileFile(`./doc/index.pug`, { self: true })
const output   = `./doc/index.html`
const locals   = {}
locals.features = loadAll(readFileSync('./doc/features.yaml'))
writeFileSync(output, template(locals))
