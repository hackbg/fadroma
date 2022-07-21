#!/usr/bin/env node

printNameVersion(require('./package.json'))
printNameVersion(require('@hackbg/ganesha/package.json'))

const commands = {
  version () {
    console.log(`\nhttps://hack.bg presents: Fadroma v${require('./package.json').version}`)
    console.log(`If you're seeing this then Fadroma installed successfully.\n`)
  },
  create  () {
    run(require.resolve('./fadroma.create.ts'))
  },
  build   () {
    run(require.resolve('./fadroma.build.ts'))
  },
}

const Ganesha = require('@hackbg/ganesha')
const [node, self, commandName, ...cmdArgs] = process.argv
const command = commands[commandName] || runScript
command(...process.argv)

function run (script) {
  Ganesha.main([node, self, script, ...cmdArgs])
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
