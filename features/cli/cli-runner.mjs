#!/usr/bin/env node
/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Console, bold, colors } from '@hackbg/logs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { readFileSync } from 'node:fs'
const { name, version } = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'package.json'))
)
const console = new Console()
console
  .log(
    `Starting ${bold(name)} ${version}...`)
  .log(colors.green(
    '█▀▀▀▀ █▀▀▀█ █▀▀▀▄ █▀▀▀█ █▀▀▀█ █▀█▀█ █▀▀▀█'))
  .log(colors.green(
    '█▀▀   █▀▀▀█ █▄▄▄▀ █▀▀▀▄ █▄▄▄█ █ ▀ █ █▀▀▀█'))
  .log(colors.green(
    'l e v e l t h e l a n d s c a p e  2021-∞'))

import * as Dotenv from 'dotenv'
Dotenv.config()

const CLI = await import("./cli-index.dist.js").catch(async e=>{
  await import("@ganesha/esbuild")
  const t0 = performance.now()
  const module = await import("./cli-index.ts")
  console.debug('Compiled TypeScript in', ((performance.now() - t0)/1000).toFixed(3)+'s')
  return module
}).then(
  module=>module.default
)

new CLI().run(process.argv.slice(2))

//#!/usr/bin/env node
//[>* Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    //You should have received a copy of the GNU Affero General Public License
    //along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
//import { Console, bold, colors } from '@hackbg/logs'
//import { fileURLToPath } from 'node:url'
//import { resolve, dirname } from 'node:path'
//import { readFileSync } from 'node:fs'
//const packageJsonPath = resolve(dirname(fileURLToPath(import.meta.url)), 'package.json')
//const { name, version } = JSON.parse(readFileSync(packageJsonPath))
//console.log(`Starting ${bold(name)} ${version}...`)
//console.log(colors.green('█▀▀▀▀ █▀▀▀█ █▀▀▀▄ █▀▀▀█ █▀▀▀█ █▀█▀█ █▀▀▀█'))
//console.log(colors.green('█▀▀   █▀▀▀█ █▄▄▄▀ █▀▀▀▄ █▄▄▄█ █ ▀ █ █▀▀▀█'))
//console.log(colors.green('l e v e l t h e l a n d s c a p e  2021-∞'))
//import * as Dotenv from 'dotenv'
//Dotenv.config()
//const CLI = await import("./agent.dist.js").catch(async e=>{
  //new Console().debug('Compiling TypeScript...')
  //await import("@ganesha/esbuild")
  //const t0 = performance.now()
  //const module = await import("./commands.ts")
  //new Console().debug('Compiled TypeScript in', ((performance.now() - t0)/1000).toFixed(3)+'s')
  //return module
//}).then(module=>module.default)
//new CLI().run(process.argv.slice(2))

//#!/usr/bin/env node
//[>* Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    //You should have received a copy of the GNU Affero General Public License
    //along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
//import { Console, bold, colors } from '@hackbg/logs'
//import { fileURLToPath } from 'node:url'
//import { resolve, dirname } from 'node:path'
//import { readFile } from 'node:fs/promises'

//const packageRoot = dirname(fileURLToPath(import.meta.url))
//const packageJsonPath = resolve(packageRoot, 'package.json')
//const { name, version } = JSON.parse(await readFile(packageJsonPath))
//console.log(`Starting ${bold(name)} ${version}...`)
//console.log(colors.green('█▀▀▀▀ █▀▀▀█ █▀▀▀▄ █▀▀▀█ █▀▀▀█ █▀█▀█ █▀▀▀█'))
//console.log(colors.green('█▀▀   █▀▀▀█ █▄▄▄▀ █▀▀▀▄ █▄▄▄█ █ ▀ █ █▀▀▀█'))
//console.log(colors.green('l e v e l t h e l a n d s c a p e  2021-∞'))

//import * as Dotenv from 'dotenv'
//Dotenv.config()

//await import("./namada.dist.js")
  //.catch(async e=>{
    //new Console().debug('Compiling TypeScript...')
    //await import("@ganesha/esbuild")
    //const t0 = performance.now()
    //const module = await import("./namada.ts")
    //new Console().debug('Compiled TypeScript in', ((performance.now() - t0)/1000).toFixed(3)+'s')
    //return module
  //})
  //.then(async module=>{
    //const wasmPath = resolve(packageRoot, 'pkg', 'fadroma_namada_bg.wasm')
    //await module.initDecoder(await readFile(wasmPath))
    //const CLI = module.default
    //return new CLI().run(process.argv.slice(2))
  //})
