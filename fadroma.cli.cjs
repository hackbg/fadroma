#!/usr/bin/env node
const Ganesha = require('@hackbg/ganesha');

const [node, self, command, ...cmdArgs] = process.argv

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

;(commands[command] || runScript)(...process.argv)

function run (command) {
  Ganesha.main([node, self, command, ...cmdArgs])
}

function runScript () {
  Ganesha.main()
}
