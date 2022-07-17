#!/usr/bin/env node
const { extname, resolve, basename, relative, join, isAbsolute } = require('path')
const { existsSync, readFileSync, writeFileSync } = require('fs')
const { execSync, execFileSync } = require('child_process')
const { request } = require('https')
const process = require('process')
const concurrently = require('concurrently')
const fetch = require('node-fetch')
module.exports = module.exports.default = izomorf
if (require.main === module) izomorf(process.cwd(), ...process.argv.slice(2))
const TSC = process.env.TSC || 'tsc'
async function izomorf (cwd, dryWet, ...publishArgs) {

  const dry = dryWet !== 'wet'

  if (dry && !publishArgs.includes('--dry-run')) {
    publishArgs.unshift('--dry-run')
  }

  if (!dry) {
    // Start with a dry run
    execFileSync(
      'pnpm', ['publish', '--dry-run'],
      { cwd, stdio: 'inherit', env: process.env }
    )
  }

  // Read package.json
  const original     = readFileSync($('package.json'), 'utf8')
  const packageJson  = JSON.parse(original)
  const isTypescript = (packageJson.main||'').endsWith('.ts')

  // Check if this version is already uploaded
  const name    = packageJson.name
  const version = packageJson.version
  const url     = `https://registry.npmjs.org/${name}/${version}`
  const response = await fetch(url)
  if (response.status === 200) {
    console.log(`${name} ${version} already exists, not publishing:`, url)
    return
  } else if (response.status !== 404) {
    throw new Error(`izomorf: NPM returned ${response.statusCode}`)
  }

  // Patch package.json
  try {

    if (isTypescript) {

      const result = await concurrently([
        `${TSC} --outDir dist/esm --target es6 --module es6 --declaration --declarationDir dist/dts`,
        `${TSC} --outDir dist/cjs --target es6 --module commonjs`
      ]).result

      // Compile TS -> JS
      const source           = $(packageJson.main || 'index.ts')
      const browserSource    = $(packageJson.browser || source)
      const replaceExtension = (x, a, b) => `${basename(x, a)}${b}`
      const dtsBuild         = $('dist/dts', replaceExtension(source, '.ts', '.js'))
      const esmBuild         = $('dist/esm', replaceExtension(source, '.ts', '.js'))
      const cjsBuild         = $('dist/cjs', replaceExtension(source, '.ts', '.js'))

      // Set main, types, and exports fields in package.json
      if (packageJson.type === 'module') {
        Object.assign(packageJson, {
          main:    toRel(esmBuild),
          types:   toRel(dtsBuild),
          exports: { source: toRel(source), require: toRel(cjsBuild), default: toRel(esmBuild) },
        })
      } else {
        Object.assign(packageJson, {
          main:    toRel(cjsBuild),
          types:   toRel(dtsBuild),
          exports: { source: toRel(source), import: toRel(esmBuild), default: toRel(cjsBuild) },
        })
      }

      // Write modified package.json
      console.warn("\nTemporary modification to package.json (don't commit!)\n")
      const modified = JSON.stringify(packageJson, null, 2)
      console.log(modified)
      writeFileSync($('package.json'), modified, 'utf8')

      // Publish the package, thus modified, to NPM
      console.log(`\npnpm publish --no-git-checks`, ...publishArgs)
      execFileSync(
        'pnpm', ['publish', '--no-git-checks', ...publishArgs],
        { cwd, stdio: 'inherit', env: process.env }
      )

    } else {

      // Publish the package, unmodified, to NPM
      console.log(`\npnpm publish`, ...publishArgs)
      execFileSync(
        'pnpm', ['publish', ...publishArgs],
        { cwd, stdio: 'inherit', env: process.env }
      )

    }

    if (!dry) {
      // Add Git tag
      execSync(`git tag -f "npm/${packageJson.name}/${packageJson.version}"`, { cwd, stdio: 'inherit' })
    }

  } finally {
    // Restore original contents of package.json
    writeFileSync($('package.json'), original, 'utf8')
  }

  // Find file relative to working directory
  function $ (...args) {
    return join(cwd, ...args)
  }

  // Convert absolute path to relative
  function toRel (path) {
    return `./${isAbsolute(path)?relative(cwd, path):path}`
  }

}
