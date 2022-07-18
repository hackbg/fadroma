#!/usr/bin/env node
const { extname, resolve, basename, relative, join, isAbsolute } = require('path')
const { existsSync, readFileSync, writeFileSync, readdirSync, copyFileSync } = require('fs')
const { execSync, execFileSync } = require('child_process')
const { request } = require('https')
const process = require('process')
const concurrently = require('concurrently')
const fetch = require('node-fetch')
module.exports = module.exports.default = izomorf
const TSC = process.env.TSC || 'tsc'
if (require.main === module) izomorf(process.cwd(), ...process.argv.slice(2)).then(()=>process.exit(0))
async function izomorf (cwd, dryWet, ...publishArgs) {

  const dry = dryWet !== 'wet'

  // Read package.json
  const original     = readFileSync($('package.json'), 'utf8')
  const packageJson  = JSON.parse(original)

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

  // Patch package.json
  try {
    const isTypescript = (packageJson.main||'').endsWith('.ts')
    if (isTypescript) {
      const dtsOut = 'dist/dts'
      const esmOut = 'dist/esm'
      const cjsOut = 'dist/cjs'
      const replaceExtension = (x, a, b) => `${basename(x, a)}${b}`
      // Compile TS -> JS
      const result = await concurrently([
        `${TSC} --outDir ${esmOut} --target es2016 --module es6 --declaration --declarationDir ${dtsOut}`,
        `${TSC} --outDir ${cjsOut} --target es6 --module commonjs`
      ]).result
      const files = []
      for (const file of readdirSync($(dtsOut))) {
        if (file.endsWith('.d.ts')) {
          copyFileSync($(dtsOut, file), $(file))
          files.push(file)
        }
      }
      for (const file of readdirSync($(esmOut))) {
        if (file.endsWith('.js')) {
          const newFile = replaceExtension(file, '.js', '.esm.js')
          copyFileSync($(esmOut, file), $(newFile))
          files.push(newFile)
        }
      }
      for (const file of readdirSync($(cjsOut))) {
        if (file.endsWith('.js')) {
          const newFile = replaceExtension(file, '.js', '.cjs.js')
          copyFileSync($(cjsOut, file), $(newFile))
          files.push(newFile)
        }
      }
      const main        = $(packageJson.main    || 'index.ts')
      const browserMain = $(packageJson.browser || 'index.browser.ts')
      const dtsMain     = replaceExtension(main, '.ts', '.d.ts')
      const esmMain     = replaceExtension(main, '.ts', '.esm.js')
      const cjsMain     = replaceExtension(main, '.ts', '.cjs.js')
      // Set main, types, files, and exports fields in package.json
      if (packageJson.type === 'module') {
        Object.assign(packageJson, {
          main:    toRel(esmMain),
          types:   toRel(dtsMain),
          exports: { source: toRel(main), require: toRel(cjsMain), default: toRel(esmMain) },
        })
      } else {
        Object.assign(packageJson, {
          main:    toRel(cjsMain),
          types:   toRel(dtsMain),
          exports: { source: toRel(main), import: toRel(esmMain), default: toRel(cjsMain) },
        })
      }
      console.log(files, packageJson.files)
      packageJson.files = [...new Set([
        ...packageJson.files||[],
        ...files
      ])].sort()

      // Write modified package.json
      console.warn("\nTemporary modification to package.json (don't commit!)\n")
      const modified = JSON.stringify(packageJson, null, 2)
      console.log(modified)
      writeFileSync($('package.json'), modified, 'utf8')

      execFileSync(
        'ls', ['-al'],
        { cwd, stdio: 'inherit', env: process.env }
      )

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

    if (dry) {
      console.log('Dry run successful.')
    } else {
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
