import { Deployment } from '@hackbg/fadroma'
import $ from '@hackbg/kabinet'

export class ExampleDeployment extends Deployment {

  deploy = this.command('deploy', 'deploy echo and kv contracts', async () => {
    return await Promise.all([this.echo, this.kv])
  })

  echo = this.contract({ crate: 'kv', name: 'KV' })
    .deploy({})

  kv = this.contract({ crate: 'echo', name: 'Echo' })
    .deploy(async () => ({ dependency: (await this.echo).asLink }))

}

export default new ExampleDeployment()
