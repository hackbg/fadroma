#!/usr/bin/env node
/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/

const t0 = performance.now()

import { Console, bold, colors } from '@hackbg/logs'

const { SyncFS, FileFormat } = await import('@hackbg/file')
const { name, version } = new SyncFS.File(import.meta.url)
  .parent
  .file("package.json")
  .setFormat(FileFormat.JSON)
  .load()

console = new Console()
console
  .log(
    `Starting ${pkgj.name} ${pkgj.version}...`)
  .log(colors.green(
    '█▀▀▀▀ █▀▀▀█ █▀▀▀▄ █▀▀▀█ █▀▀▀█ █▀█▀█ █▀▀▀█'))
  .log(colors.green(
    '█▀▀   █▀▀▀█ █▄▄▄▀ █▀▀▀▄ █▄▄▄█ █ ▀ █ █▀▀▀█'))
  .log(bold(colors.green(
    'l e v e l t h e l a n d s c a p e  2021-∞')))

import * as Dotenv from 'dotenv'
Dotenv.config()

const CLI = await import("./devnet.dist.js").catch(async e=>{
  await import("@hackbg/ganesha")
  return await import("./devnet.ts")
}).then(
  module=>module.default
)
console.log({CLI})

new CLI().run(process.argv.slice(2))
