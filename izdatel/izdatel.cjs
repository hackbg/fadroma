const { resolve, basename, relative, join, isAbsolute } = require('path')
const { readFileSync, writeFileSync } = require('fs')
const { execSync, execFileSync } = require('child_process')
const process = require('process')
module.exports = module.exports.default = izdatel
if (require.main === module) izdatel(process.cwd(), ...process.argv.slice(2))
function izdatel (cwd, prepareCommand = 'npm prepare', ...publishArgs) {
  const $ = (...args) => join(cwd, ...args)
  const files = {
    packageJSON:  $('package.json'),
    tsconfigJSON: $('tsconfig.json'),
  }
  // Get output directory from tsconfig.json
  const { compilerOptions = {} } = JSON.parse(readFileSync(files.tsconfigJSON, 'utf8'))
  const { outDir = '.', declaration, declarationDir = outDir } = compilerOptions
  // Get original contents of package.json
  const original    = readFileSync(files.packageJSON, 'utf8')
  const packageJSON = JSON.parse(original)
  try {
    // Compile TS -> JS
    execSync(prepareCommand, { cwd, stdio: 'inherit' })
    Object.assign(files, {
      source:   packageJSON.main || 'index.ts',
    })
    Object.assign(files, {
      typedefs: $(declarationDir, `${basename(files.source, '.ts')}.d.ts`),
      esmBuild: $(outDir,         `${basename(files.source, '.ts')}.import.js`),
      cjsBuild: $(outDir,         `${basename(files.source, '.ts')}.require.js`),
    })
    // Set types field
    if (declaration) {
      packageJSON.types = typedefs
    }
    // Set main and exports fields
    if (packageJSON.type === "module") {
      packageJSON.main = files.esmBuild
      packageJSON.exports = {
        source:  files.source,
        require: files.cjsBuild,
        default: files.esmBuild
      }
    } else {
      packageJSON.main = files.cjsBuild
      packageJSON.exports = {
        source:  files.source,
        import:  files.cjsBuild,
        default: files.esmBuild
      }
    }
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
