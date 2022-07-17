const { resolve, basename, relative, join, isAbsolute } = require('path')
const { existsSync, readFileSync, writeFileSync } = require('fs')
const { execSync, execFileSync } = require('child_process')
const process = require('process')
module.exports = module.exports.default = izomorf
if (require.main === module) izomorf(process.cwd(), ...process.argv.slice(2))
function izomorf (cwd, prepareCommand = 'npm prepare', ...publishArgs) {

  // Find file relative to working directory
  function $ (...args) {
    return join(cwd, ...args)
  }

  // Configuration loader
  function getConfig (variant = '') {
    const file = $(`tsconfig${variant}.json`)
    if (existsSync(file)) {
      const { compilerOptions = {} } = JSON.parse(readFileSync(file, 'utf8'))
      return [compilerOptions.outDir, compilerOptions.declaration, compilerOptions.declarationDir]
    } else {
      console.info(`Not found:`, file)
      return [undefined, undefined, undefined]
    }
  }

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

  // Patch package.json
  const original    = readFileSync($('package.json'), 'utf8')
  const packageJSON = JSON.parse(original)
  try {

    // Compile TS -> JS
    execSync(prepareCommand, { cwd, stdio: 'inherit' })
    const toRelative       = path => isAbsolute(path)?relative(cwd, path):path
    const source           = $(packageJSON.main || 'index.ts')
    const browserSource    = $(packageJSON.browser || source)
    const replaceExtension = (x, a, b) => `${basename(x, a)}${b}`
    const esmBuild         = $(outDirESM, replaceExtension(files.source, '.ts', '.esm.js'))
    const cjsBuild         = $(outDirCJS, replaceExtension(files.source, '.ts', '.cjs.js'))

    // Set main, types, and exports fields in package.json
    Object.assign(packageJSON, (packageJSON.type === "module")
      ? ({

        main: toRelative(files.esmBuild),
        exports: {
          source:  toRelative(files.source),
          require: toRelative(files.cjsBuild),
          default: toRelative(files.esmBuild)
        },
        ...declarationESM ? { types: toRelative(
          $(declarationDirESM, replaceExtension(files.source, '.ts', '.d.ts'))
        ) } : {},

      }) : ({

        main: toRelative(files.cjsBuild),
        exports: {
          source:  toRelative(files.source),
          import:  toRelative(files.esmBuild),
          default: toRelative(files.cjsBuild)
        },
        ...declarationCJS ? { types: toRelative(
          $(declarationDirCJS, replaceExtension(files.source, '.ts', '.d.ts'))
        ) } : {},

      }))

    // Set "files" field of package.json
    const sortedDistinct = (a=[], b=[]) => [...new Set([...a, ...b])].sort()
    Object.assign(packageJSON, {
      files: sortedDistinct(packageJSON.files, Object.values(files).map(toRelative))
    })

    // Write modified package.json
    const modified = JSON.stringify(packageJSON, null, 2)
    console.log(modified)
    writeFileSync($('package.json'), modified, 'utf8')

    // Publish the package, thus modified, to NPM
    console.log(`\npnpm publish --no-git-checks`, ...publishArgs)
    execFileSync(
      'pnpm', ['publish', '--no-git-checks', ...publishArgs],
      { cwd, stdio: 'inherit', env: process.env }
    )

    // Add Git tag
    execSync(`git tag -f "npm/${packageJSON.name}/${packageJSON.version}"`, { cwd, stdio: 'inherit' })

  } finally {
    // Restore original contents of package.json
    writeFileSync($('package.json'), original, 'utf8')
  }

}
