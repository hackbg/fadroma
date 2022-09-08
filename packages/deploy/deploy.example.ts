import { Deployment } from '@hackbg/fadroma'
import $ from '@hackbg/kabinet'

export class ExampleDeployment extends Deployment {

  constructor (options: Partial<ExampleDeployment> = {}) {
    super(options as Partial<Deployment>)
    this.command('echo', 'deploy echo contract')
    this.command('kv',   'deploy kv contract')
    this.command('all',  'deploy both contracts')
  }

  echo = this.contract()
    .fromCrate('kv')
    .withName('KV')
    .deploy({})

  kv = this.contract()
    .fromCrate('echo')
    .withName('Echo')
    .deploy(async () => ({ dependency: (await this.echo).asLink }))

  all = this.subtask(()=>Promise.all([
    this.echo,
    this.kv
  ]))

}

export default new ExampleDeployment()
