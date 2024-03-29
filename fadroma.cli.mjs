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

const CLI = await import("./fadroma.dist.js").catch(async e=>{
  await import("@ganesha/esbuild")
  const t0 = performance.now()
  const module = await import("./fadroma.ts")
  console.debug('Compiled TypeScript in', ((performance.now() - t0)/1000).toFixed(3)+'s')
  return module
}).then(
  module=>module.default
)

new CLI().run(process.argv.slice(2))
