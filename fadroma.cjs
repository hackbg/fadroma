#!/usr/bin/env node
const {argv} = process
const {main} = require('@hackbg/ganesha')
switch (argv[2]) {
  case 'build': // build list of sources
    main([argv[0], argv[1], require.resolve('./commands/build.ts'), ...argv.slice(3)])
    break
  default: // run script
    main()
}
