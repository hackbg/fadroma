import { BuildCommands } from '@fadroma/build'
import $ from '@hackbg/kabinet'

export default class ExampleBuild extends BuildCommands {

  constructor (options: Partial<ExampleBuild> = {}) {
    super(options as Partial<BuildCommands>)
    this.command('echo', 'build echo contract', this.echo)
    this.command('kv',   'build kv contract',   this.kv)
    this.command('all',  'build all contracts', this.all)
  }

  repo = $('.')

  echo = () => this.contract()
    .fromWorkspace(this.repo.path)
    .fromCrate('echo')
    .build()

  kv = () => this.contract()
    .fromWorkspace(this.repo.path)
    .fromCrate('kv')
    .build()

  all = () => Promise.all([
    this.echo(), 
    this.kv()
  ])

}
