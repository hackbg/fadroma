import { BuildCommands } from '@fadroma/build'
import $ from '@hackbg/kabinet'

export default class ExampleBuild extends BuildCommands {

  constructor (options: Partial<ExampleBuild> = {}) {
    super(options as Partial<BuildCommands>)
    this.command('echo', 'build echo contract', this.echo)
    this.command('kv',   'build kv contract',   this.kv)
    this.command('all',  'build all contracts', this.all)
  }

  project = '.'

  echo = () => this.contract({ crate: 'echo' }).build()

  kv   = () => this.contract({ crate: 'kv' }).build()

  all  = () => Promise.all([this.echo(), this.kv()])

}
