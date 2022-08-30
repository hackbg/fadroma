#!/usr/bin/env node

printNameVersion(require('./package.json'))
printNameVersion(require('@hackbg/ganesha/package.json'))

let dotenv
try { dotenv = require('dotenv') } catch (e) {}
if (dotenv) dotenv.config()

const commands = {
  version () {
    console.log(`\nhttps://hack.bg presents: Fadroma v${require('./package.json').version}`)
    console.log(`If you're seeing this then Fadroma installed successfully.\n`)
  },
}

for (const pkg of [
  'build',
  'connect',
  //'create',
  'deploy',
  'devnet',
  'mocknet',
  //'repl',
  'tokens',
  'scrt',
  'scrt-amino'
]) {
  let cmd
  try {
    cmd = require.resolve(`@fadroma/${pkg}`)
  } catch (e) {}
  if (cmd) {
    commands[pkg] = () => run(cmd)
  } else {
    commands[pkg] = () => `@fadroma/${pkg} is not available`
  }
}

const Ganesha = require('@hackbg/ganesha')
const [node, self, commandName, ...args] = process.argv
const command = commands[commandName] || runScript
command(...process.argv)

function run (script) {
  Ganesha.main([node, self, script, ...args])
}

function runScript () {
  if (!commandName) {
    // TODO setup repl
  }
  Ganesha.main()
}

function printNameVersion (pkg) {
  console.log(`${pkg.name} ${pkg.version}`)
}
