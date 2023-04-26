#!/usr/bin/env node
let dotenv; try { dotenv = require('dotenv') } catch (e) { console.log(e); dotenv = null }
if (dotenv) dotenv.config()
const { join, resolve } = require('path')
const { readFileSync } = require('fs')
const node = process.argv[0]
const cmds = require.resolve('@hackbg/cmds/cmds-ts.cli.cjs')
const pkgj = JSON.parse(readFileSync(resolve(__dirname, 'package.json')), 'utf8')
console.log(`@hackbg/fadroma ${pkgj.version}`)
const main = process.env.FADROMA_OPS
  ? resolve(process.cwd(), process.env.FADROMA_OPS)
  : resolve(__dirname, pkgj.main)
console.log(main)
process.argv = [ node, cmds, main, ...process.argv.slice(2) ]
require('@hackbg/cmds/cmds-ts.cli.cjs')
