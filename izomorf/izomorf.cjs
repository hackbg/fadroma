#!/usr/bin/env node
const { extname, resolve, basename, relative, join, isAbsolute } = require('path')
const { existsSync, readFileSync, writeFileSync } = require('fs')
const { execSync, execFileSync } = require('child_process')
const process = require('process')
module.exports = module.exports.default = izomorf
if (require.main === module) izomorf(process.cwd(), ...process.argv.slice(2))

const tsc = process.env.TSC || 'tsc'

async function izomorf (cwd, prepareCommand = 'npm prepare', ...publishArgs) {

  // Start with a dry run
  execFileSync(
    'pnpm', ['publish', '--dry-run'],
    { cwd, stdio: 'inherit', env: process.env }
  )

  // Read package.json
  const original    = readFileSync($('package.json'), 'utf8')
  const packageJson = JSON.parse(original)

  const isTypescript = (packageJson.main||'').endsWith('.ts')

  // Find file relative to working directory
  function $ (...args) {
    return join(cwd, ...args)
  }

  // Convert absolute path to relative
  function toRel (path) {
    `./${isAbsolute(path)?relative(cwd, path):path}`
  }

  // Patch package.json
  try {

    if (isTypescript) {

      const result = await concurrently(
        `${TSC} --outDir dist/esm --target es6 --module es6 --declaration --declarationDir dist/dts`,
        `${TSC} --outDir dist/cjs --target es6 --module commonjs`
      ).result

      console.log({result})
      process.exit(123)

      execFileSync(
        tsc, [ "--outDir", "dist/cjs", "--target", "es6", "--module", "commonjs" ],
        { cwd, stdio: 'inherit', env: process.env }
      )

      // Configuration - what files are emitted by the builds and where
      let [outDir            = './dist',
           declaration       = true,
           declarationDir    = outDir]    = getConfig()

      let [outDirEsm         = outDir + '/esm',
           declarationEsm    = declaration,
           declarationDirEsm = outDirEsm] = getConfig('.esm')

      let [outDirCjs         = outDir + '/cjs',
           declarationCjs    = declaration,
           declarationDirCjs = outDirCjs] = getConfig('.cjs')

      // Compile TS -> JS
      execSync(prepareCommand, { cwd, stdio: 'inherit' })
      const source           = $(packageJson.main || 'index.ts')
      const browserSource    = $(packageJson.browser || source)
      const replaceExtension = (x, a, b) => `${basename(x, a)}${b}`
      const esmBuild         = $(outDirEsm, replaceExtension(source, '.ts', '.js'))
      const cjsBuild         = $(outDirCjs, replaceExtension(source, '.ts', '.js'))

      // Set main, types, and exports fields in package.json
      if (packageJson.type === 'module') { patchPackageJsonEsm() } else { patchPackageJsonCjs() }
      function patchPackageJsonEsm () {
        Object.assign(packageJson, {
          main:    toRel(esmBuild),
          exports: { source: toRel(source), require: toRel(cjsBuild), default: toRel(esmBuild) },
        })
        if (declarationEsm) packageJson.types = toRel(
          $(declarationDirEsm, replaceExtension(source, '.ts', '.d.ts'))
        )
      }
      function patchPackageJsonCjs () {
        Object.assign(packageJson, {
          main:    toRel(cjsBuild),
          exports: { source: toRel(source), import: toRel(esmBuild), default: toRel(cjsBuild) },
        })
        if (declarationCjs) packageJson.types = toRel(
          $(declarationDirCjs, replaceExtension(source, '.ts', '.d.ts'))
        )
      }

      packageJson.types = $(outDir, 'types', replaceExtension(source, '.ts', '.d.ts'))

      // Configuration loader
      function getConfig (variant = '') {
        const file = $(`tsconfig${variant}.json`)
        if (existsSync(file)) {
          const { compilerOptions = {} } = JSON.parse(readFileSync(file, 'utf8'))
          return [compilerOptions.outDir, compilerOptions.declaration, compilerOptions.declarationDir]
        } else {
          return [undefined, undefined, undefined]
        }
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

      // Publish the package, thus modified, to NPM
      console.log(`\npnpm publish`, ...publishArgs)
      execFileSync(
        'pnpm', ['publish', ...publishArgs],
        { cwd, stdio: 'inherit', env: process.env }
      )

    }

    // Add Git tag
    execSync(`git tag -f "npm/${packageJson.name}/${packageJson.version}"`, { cwd, stdio: 'inherit' })

  } finally {
    // Restore original contents of package.json
    writeFileSync($('package.json'), original, 'utf8')
  }

}
