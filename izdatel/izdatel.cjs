const { resolve, basename, relative } = require('path')
const { readFileSync, writeFileSync } = require('fs')
const { execSync } = require('child_process')
const process = require('process')

module.exports = module.exports.default = izdatel

if (require.main === module) izdatel()

function izdatel (cwd = process.cwd()) {

  // get output directory from tsconfig.json
  const {
    compilerOptions: { outDir = '.', declaration, declarationDir = outDir } = {}
  } = JSON.parse(readFileSync(resolve(cwd, 'tsconfig.json'), 'utf8'))

  // get original contents of tsconfig.json
  const packageJSON = resolve(cwd, 'package.json')
  const original    = readFileSync(packageJSON, 'utf8')
  try {

    // compile TS -> JS
    execSync('npm run build', { cwd, stdio: 'inherit' })

    // update "main" and "types" in tsconfig.json
    const data = JSON.parse(original)
    const main = data.main || 'index.ts'
    const name = basename(main, '.ts')
    data.source = main
    data.main = relative(cwd, resolve(outDir, `${name}.js`))
    if (declaration) {
      data.types = relative(cwd, resolve(declarationDir, `${name}.d.ts`))
    }
    console.log(JSON.stringify(data, null, 2))
    writeFileSync(packageJSON, JSON.stringify(data), 'utf8')

    // publish modified package to NPM
    execSync('npm publish --access public', { cwd, stdio: 'inherit' })

  } finally {

    // restore original contents of package.json
    writeFileSync(packageJSON, original, 'utf8')

  }

}
