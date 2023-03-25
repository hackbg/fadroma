import { readFileSync, writeFileSync } from 'fs'
import { compileFile } from 'pug'
import { loadAll } from 'js-yaml'
import markdownIt from 'markdown-it'
// Compile the homepage template
const template = compileFile(`./homepage/index.pug`, { self: true })
// Render the homepage
writeFileSync(`./homepage/index.html`, template({
  // When running in CI, debug info is not shown
  CI:       process.env.CI,
  // Markdown renderer
  markdown: markdownIt(),
  // Feature descriptions
  features: loadAll(readFileSync('./homepage/features.yaml')),
  // Icons as inline svg paths, see https://icomoon.io/#docs/inline-svg
  icons:    loadAll(readFileSync('./homepage/icons.yaml')),
}))
