#!/usr/bin/env node
const {argv} = process
const [interpreter, script, command, ...args] = argv
const {main} = require('@hackbg/ganesha')
switch (command) {
  case 'version':
    console.log(`\nhttps://hack.bg presents: Fadroma v${require('./package.json').version}`)
    console.log(`If you're seeing this then Fadroma installed successfully.\n`)
    break
  case 'create': // scaffold new project
    main([interpreter, script, require.resolve('./create.ts'), ...args])
    break
  case 'build': // build list of sources
    main([interpreter, script, require.resolve('./build.ts'), ...args])
    break
  default: // run passed script
    main()
}
