import Mocha from 'mocha'
import {resolve, dirname} from 'path'
import {fileURLToPath} from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)))
const mocha = new Mocha()

mocha.addFile(resolve(root, 'agent.spec.mjs'))
mocha.addFile(resolve(root, 'builder.spec.mjs'))
mocha.addFile(resolve(root, 'contract.spec.mjs'))
mocha.addFile(resolve(root, 'ensemble.spec.mjs'))
mocha.addFile(resolve(root, 'devnet.spec.mjs'))

mocha.loadFilesAsync()
  .then(() => {
    mocha.run(failures => process.exitCode = failures ? 1 : 0) })
  .catch(e => {
    console.error(e)
    process.exitCode = 1 })
