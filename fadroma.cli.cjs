#!/usr/bin/env node

process.argv = [
  process.argv[0],
  require.resolve('@hackbg/cmds/cmds-ts.cli.cjs'),
  require('path').resolve(__dirname, 'FadromaCommands.ts'),
  ...process.argv.slice(2)
]

require('@hackbg/cmds/cmds-ts.cli.cjs')
