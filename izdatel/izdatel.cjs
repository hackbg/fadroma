const { resolve, rasename, relative, join } = require('path')
const { readFileSync, writeFileSync } = require('fs')
const { execSync } = require('child_process')
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
      typedefs: $(declarationDir, `${basename(source, '.ts')}.d.ts`), 
      esmBuild: $(outDir,         `${basename(source, '.ts')}.import.js`),
      cjsBuild: $(outDir,         `${basename(source, '.ts')}.require.js`),
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
    // Write modified package.json
    const modified = JSON.stringify(packageJSON, null, 2)
    console.log(modified)
    writeFileSync(files.packageJSON, modified, 'utf8')
    // Publish modified package to NPM
    execFileSync(
      'pnpm',
      ['publish', '--dry-run', '--no-git-checks', ...publishArgs],
      { cwd, stdio: 'inherit', env: process.env }
    )
    // Add Git tag
    execSync(`git tag "npm/${packageJSON.name}/${packageJSON.version}"`, { cwd, stdio: 'inherit' })
  } finally {
    // Restore original contents of package.json
    writeFileSync(files.packageJSON, original, 'utf8')
  }
}
