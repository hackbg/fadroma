export const command = (name, ...steps) =>
  () => { throw new Error('TODO') }

export const commandOption = (name, ...steps) =>
  () => { throw new Error('TODO') }

export const defaultCli = command(null,
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
    commandOption('full'),
    commandOption('debug')))
