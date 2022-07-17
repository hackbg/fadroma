#!/usr/bin/env node
const Ganesha = require('@hackbg/ganesha')

;({
  version (node, self, command, ...cmdArgs) {
    console.log(`\nhttps://hack.bg presents: Fadroma v${require('./package.json').version}`)
    console.log(`If you're seeing this then Fadroma installed successfully.\n`)
  }
  create  (node, self, command, ...cmdArgs) {
    Ganesha.main([node, self, require.resolve('./create.ts'), ...cmdArgs])
  }
  build   (node, self, command, ...cmdArgs) {
    Ganesha.main([interpreter, script, require.resolve('./build.ts'), ...cmdArgs])
  }
  publish (node, self, command, ...cmdArgs) {
    require('@hackbg/izomorf')(process.cwd(), ...cmdArgs)
  }
}[command] || runScript)(...process.argv)

function runScript () { Ganesha.main() }
