const command = (name, ...steps) => () => { throw new Error('TODO') }

const flag = (name, ...steps) => () => { throw new Error('TODO') }

export const CLI = command(null,
  command('build',
    command('debug'),
    command('mocks'),
    command('release')),
  command('clone'),
  command('deploy'),
  command('keys',
    command('check'),
    command('regen')),
  command('localnet',
    command('deployed'),
    command('wait')),
  command('repl'),
  command('test',
    flag('full'),
    flag('debug')))
