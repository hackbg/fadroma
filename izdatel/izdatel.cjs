const { resolve, basename, relative, join, isAbsolute } = require('path')
const { existsSync, readFileSync, writeFileSync } = require('fs')
const { execSync, execFileSync } = require('child_process')
const process = require('process')
module.exports = module.exports.default = izdatel
if (require.main === module) izdatel(process.cwd(), ...process.argv.slice(2))
function izdatel (cwd, prepareCommand = 'npm prepare', ...publishArgs) {

  // Finding some files
  const $ = (...args) => join(cwd, ...args)
  const files = {
    packageJSON:     $('package.json'),
    tsconfigJSON:    $('tsconfig.json'),
    tsconfigESMJSON: $('tsconfig.esm.json'),
    tsconfigCJSJSON: $('tsconfig.cjs.json'),
  }

  // Output directory for ESM build
  if (!existsSync(files.tsconfigESMJSON)) throw new Error('could not find tsconfig.esm.json')
  const {
    compilerOptions: {
      outDir:         outDirESM         = './dist/esm',
      declaration:    declarationESM    = true,
      declarationDir: declarationDirESM = outDirESM
    }
  } = JSON.parse(readFileSync(files.tsconfigESMJSON, 'utf8'))

  // Output directory for CJS build
  if (!existsSync(files.tsconfigCJSJSON)) throw new Error('could not find tsconfig.cjs.json')
  const {
    compilerOptions: {
      outDir:         outDirCJS         = './dist/cjs',
      declaration:    declarationCJS    = true,
      declarationDir: declarationDirCJS = outDirCJS
    }
  } = JSON.parse(readFileSync(files.tsconfigCJSJSON, 'utf8'))

  // Get original contents of package.json
  const original    = readFileSync(files.packageJSON, 'utf8')
  const packageJSON = JSON.parse(original)

  try {
    // Compile TS -> JS
    execSync(prepareCommand, { cwd, stdio: 'inherit' })
    Object.assign(files, { source: packageJSON.main || 'index.ts', })
    const replaceExtension = (x, a, b) => `${basename(x, a)}${b}`
    Object.assign(files, {
      esmBuild: $(outDirESM, replaceExtension(files.source, '.ts', '.esm.js')),
      cjsBuild: $(outDirCJS, replaceExtension(files.source, '.ts', '.cjs.js')),
    })
    // Set main, types, and exports fields in package.json
    if (packageJSON.type === "module") {
      packageJSON.main = files.esmBuild
      if (declarationESM) {
        packageJSON.types = $(declarationDirESM, replaceExtension(files.source, '.ts', '.d.ts'))
      }
      packageJSON.exports = {
        source:  files.source,
        require: files.cjsBuild,
        default: files.esmBuild
      }
    } else {
      packageJSON.main = files.cjsBuild
      if (declarationCJS) {
        packageJSON.types = $(declarationDirCJS, replaceExtension(files.source, '.ts', '.d.ts'))
      }
      packageJSON.exports = {
        source:  files.source,
        import:  files.esmBuild,
        default: files.cjsBuild
      }
    }
    Object.assign(files, { typedefs: packageJSON.types })
    // Set files field
    const sortedDistinct = (a=[], b=[]) => [...new Set([...a, ...b])].sort()
    packageJSON.files = sortedDistinct(
      packageJSON.files,
      Object.values(files).map(path=>isAbsolute(path)?relative(cwd, path):path)
    )
    // Write modified package.json
    const modified = JSON.stringify(packageJSON, null, 2)
    console.log(modified)
    writeFileSync(files.packageJSON, modified, 'utf8')
    // Publish modified package to NPM
    execFileSync(
      'pnpm',
      ['publish', '--no-git-checks', ...publishArgs],
      { cwd, stdio: 'inherit', env: process.env }
    )
    // Add Git tag
    execSync(`git tag "npm/${packageJSON.name}/${packageJSON.version}"`, { cwd, stdio: 'inherit' })
  } finally {
    // Restore original contents of package.json
    writeFileSync(files.packageJSON, original, 'utf8')
  }
}
