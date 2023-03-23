import { readFileSync, writeFileSync } from 'fs'
import { compileFile } from 'pug'
import { loadAll } from 'js-yaml'
import markdownIt from 'markdown-it'

// Homepage template
const template = compileFile(`./homepage/index.pug`, { self: true })

// Data for template
const context = {}

context.markdown = markdownIt()

// Icons as inline svg paths, see https://icomoon.io/#docs/inline-svg
context.icons = loadAll(readFileSync('./homepage/icons.yaml'))

// Feature descriptions
context.features = loadAll(readFileSync('./homepage/features.yaml'))

// Render template with data
writeFileSync(`./homepage/index.html`, template(context))
