#!/usr/bin/env node
/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
const t0 = performance.now()
const { join, resolve, relative } = require('path')
const { readFileSync } = require('fs')
const { Console, bold, colors } = require('@hackbg/logs')
const pkgj = JSON.parse(readFileSync(resolve(__dirname, 'package.json')), 'utf8')
console = new Console(`${pkgj.name} ${pkgj.version}`)
console
  .log(colors.green('█▀▀▀▀ █▀▀▀█ █▀▀▀▄ █▀▀▀█ █▀▀▀█ █▀█▀█ █▀▀▀█'))
  .log(colors.green('█▀▀   █▀▀▀█ █▄▄▄▀ █▀▀▀▄ █▄▄▄█ █ ▀ █ █▀▀▀█'))
require('dotenv').config()
const node = process.argv[0]
const cmds = require.resolve('@hackbg/cmds/cmds-ts.cli.cjs')
const main = resolve(__dirname, pkgj.main)
console.log(`Running ${bold(relative(process.cwd(), main))}`)
process.argv = [ node, cmds, main, ...process.argv.slice(2) ]
const t1 = performance.now()
console.log(`Ready in ${bold(String((t1 - t0).toFixed(3)))} ms`)
process.on('exit', ()=>{
  const t2 = performance.now() - (t0 + t1)
  console.log(`Exited in ${bold(String((t2 - t1).toFixed(3)))} ms`)
})
require('@hackbg/cmds/cmds-ts.cli.cjs')
// TODO
// TODO
