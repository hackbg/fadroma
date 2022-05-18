#!/usr/bin/env node
const {argv} = process
const {main} = require('@hackbg/ganesha')
switch (argv[2]) {
  case 'version':
    console.log(`\nhttps://hack.bg presents: Fadroma v${require('./package.json').version}`)
    console.log(`If you're seeing this then Fadroma installed successfully.\n`)
    break
  case 'build': // build list of sources
    main([argv[0], argv[1], require.resolve('./commands/build.ts'), ...argv.slice(3)])
    break
  default: // run script
    main()
}
