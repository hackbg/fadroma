const { resolve, basename } = require('path')
const { readFileSync, writeFileSync } = require('fs')
const { execSync } = require('child_process')
const process = require('process')

module.exports = module.exports.default = izdatel

if (require.main === module) izdatel()

function izdatel (cwd = process.cwd()) {

  // get output directory from tsconfig.json
  const {
    compilerOptions: { outDir = '.' } = {}
  } = JSON.parse(readFileSync(resolve(cwd, 'tsconfig.json'), 'utf8'))

  // get original contents of tsconfig.json
  const packageJSON = resolve(cwd, 'package.json')
  const original    = readFileSync(packageJSON, 'utf8')
  try {

    // compile TS -> JS
    execSync('npm build', { cwd, stdio: 'inherit' })

    // update "main" and "types" in tsconfig.json
    const data  = JSON.parse(original)
    const main  = data.main || 'index.ts'
    const name  = basename(main, '.ts')
    data.main   = resolve(cwd, outDir, `${name}.js`)
    data.types  = resolve(cwd, outDir, `${name}.d.ts`)
    data.source = main
    writeFileSync(packageJSON, JSON.stringify(data), 'utf8')

    // publish modified package to NPM
    execSync('npm publish --access public --dry-run', { cwd, stdio: 'inherit' })

  } finally {

    // restore original contents of package.json
    writeFileSync(packageJSON, original, 'utf8')

  }

}
