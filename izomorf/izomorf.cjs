#!/usr/bin/env node
const { extname, resolve, basename, relative, join, isAbsolute } = require('path')
const { existsSync, readFileSync, writeFileSync, readdirSync, copyFileSync, unlinkSync } = require('fs')
const { execSync, execFileSync } = require('child_process')
const { request } = require('https')
const process = require('process')

const concurrently = require('concurrently')
const fetch = require('node-fetch')

const TSC    = process.env.TSC || 'tsc'
const dtsOut = 'dist/dts'
const esmOut = 'dist/esm'
const cjsOut = 'dist/cjs'
const distDtsExt = '.dist.d.ts'
const distEsmExt = '.dist.mjs'
const distCjsExt = '.dist.cjs'
const distJsExt  = '.dist.js'

const replaceExtension = (x, a, b) => `${basename(x, a)}${b}`

if (require.main === module) izomorf(process.cwd(), ...process.argv.slice(2))
  .then(()=>process.exit(0))
  .catch(e=>{
    console.error(e)
    process.exit(1)
  })

module.exports = module.exports.default = izomorf

async function izomorf (cwd, command, ...publishArgs) {

  switch (command) {
    case 'dry':   return await release()
    case 'wet':   return await release(true)
    case 'clean': return await clean()
    default:      return usage()
  }

  async function clean () {
    await concurrently([dtsOut, esmOut, cjsOut].map(out=>`rm -rf ${out}`))
  }

  async function release (wet) {
    // Read package.json
    const original    = readFileSync($('package.json'), 'utf8')
    const packageJson = JSON.parse(original)
    console.log('Original package.json:', packageJson, '\n')
    // Check if this version is already uploaded
    const name     = packageJson.name
    const version  = packageJson.version
    const url      = `https://registry.npmjs.org/${name}/${version}`
    const response = await fetch(url)
    if (response.status === 200) {
      console.log(`${name} ${version} already exists, not publishing:`, url)
      return
    } else if (response.status !== 404) {
      throw new Error(`izomorf: NPM returned ${response.statusCode}`)
    }
    if (wet) {
      // Do a preliminary dry run
      execFileSync(
        'pnpm', ['publish', '--dry-run'],
        { cwd, stdio: 'inherit', env: process.env }
      )
    } else {
      // Make sure the final run will be dry
      if (!publishArgs.includes('--dry-run')) {
        publishArgs.unshift('--dry-run')
      }
    }
    // Patch package.json
    try {
      const isTypescript = (packageJson.main||'').endsWith('.ts')
      const isESModule   = (packageJson.type === 'module')
      if (isTypescript) {
        // Write modified package.json
        await patchPackageJson(packageJson, isESModule)
        console.warn("\nTemporary modification to package.json (don't commit!)", packageJson)
        writeFileSync($('package.json'), JSON.stringify(packageJson, null, 2), 'utf8')
        // Print the contents of the package
        console.log()
        execFileSync('ls', ['-al'], { cwd, stdio: 'inherit', env: process.env })
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
      const tag = `npm/${packageJson.name}/${packageJson.version}`
      if (wet) {
        console.log('\nPublished:', tag)
        // Add Git tag
        if (!process.env.IZOMORF_NO_TAG) {
          execSync(`git tag -f "${tag}"`, { cwd, stdio: 'inherit' })
          if (!process.env.IZOMORF_NO_PUSH) {
            execSync('git push --tags', { cwd, stdio: 'inherit' })
          }
        }
      } else {
        console.log('\nDry run successful:', tag)
      }
    } finally {
      console.log('\nRestoring original package.json')
      // Restore original contents of package.json
      writeFileSync($('package.json'), original, 'utf8')
    }
    return packageJson
  }

  // Find file relative to working directory
  function $ (...args) {
    return join(cwd, ...args)
  }

  // Convert absolute path to relative
  function toRel (path) {
    return `./${isAbsolute(path)?relative(cwd, path):path}`
  }

  async function patchPackageJson (packageJson, isESModule) {

    // Source entry points of package
    const main        = $(packageJson.main    || 'index.ts')
    const browserMain = $(packageJson.browser || 'index.browser.ts') // TODO

    // If "type" === "module", .dist.js is used for the ESM files, otherwise for the CJS ones.
    const usedEsmExt = isESModule ? distJsExt : distEsmExt
    const usedCjsExt = isESModule ? distCjsExt : distJsExt

    // Files to include in the bundle
    const files = []

    // Compile TS -> JS
    console.log('Compiling TypeScript:')
    const result = await concurrently([
      `${TSC} --outDir ${esmOut} --target es2016 --module es6 --declaration --declarationDir ${dtsOut}`,
      `${TSC} --outDir ${cjsOut} --target es6 --module commonjs`
    ]).result

    // Collect output in package root and add it to "files":
    console.log('\nFlattening package:')

    // Collect ESM output
    for (const file of readdirSync($(esmOut))) {
      if (file.endsWith('.js')) {
        const srcFile = $(esmOut, file)
        const newFile = replaceExtension(file, '.js', usedEsmExt)
        console.log(`${toRel(srcFile)} -> ${newFile}`)
        copyFileSync(srcFile, $(newFile))
        unlinkSync(srcFile)
        files.push(newFile)
      }
    }

    // Collect CJS output
    for (const file of readdirSync($(cjsOut))) {
      if (file.endsWith('.js')) {
        const srcFile = $(cjsOut, file)
        const newFile = replaceExtension(file, '.js', usedCjsExt)
        console.log(`${toRel(srcFile)} -> ${newFile}`)
        copyFileSync(srcFile, $(newFile))
        unlinkSync(srcFile)
        files.push(newFile)
      }
    }

    // Collect type definitions
    for (const file of readdirSync($(dtsOut))) {
      if (file.endsWith('.d.ts')) {
        const srcFile = $(dtsOut, file)
        const newFile = replaceExtension(file, '.d.ts', distDtsExt)
        console.log(`${toRel(srcFile)} -> ${newFile}`)
        copyFileSync(srcFile, $(newFile))
        unlinkSync(srcFile)
        files.push(newFile)
      }
    }

    // Set "main", "types", and "exports" in package.json.
    const esmMain = replaceExtension(main, '.ts', usedEsmExt)
    const cjsMain = replaceExtension(main, '.ts', usedCjsExt)
    const dtsMain = replaceExtension(main, '.ts', distDtsExt)
    packageJson.types = toRel(dtsMain)
    packageJson.exports = { source: toRel(main) }
    if (isESModule) {
      packageJson.main            = toRel(esmMain)
      packageJson.exports.require = toRel(cjsMain)
      packageJson.exports.default = toRel(esmMain)
    } else {
      packageJson.main            = toRel(esmMain)
      packageJson.exports.import  = toRel(cjsMain)
      packageJson.exports.default = toRel(esmMain)
    }

    // Set "files" in package.json
    packageJson.files = [...new Set([...packageJson.files||[], ...files])].sort()

  }

  function usage () {
    console.log(`
    Usage:
      izomorf dry   - test publishing of package
      izomorf wet   - publish package
      izomorf clean - delete dist files`)
  }

}
