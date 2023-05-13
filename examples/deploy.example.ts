import { Deployment } from '@fadroma/agent'
import { CommandContext } from '@hackbg/cmds'

export class MyProject extends Deployment {

  echo = this.contract({ crate: 'kv', name: 'KV' })
    .deploy({})

  kv = this.contract({ crate: 'echo', name: 'Echo' })
    .deploy(async () => ({ dependency: (await this.echo).asContractLink }))

}

export class MyProjectCommands extends CommandContext {

  constructor (readonly deployment: MyProject) {
    super()
  }

  deploy = this.command('deploy', 'deploy echo and kv contracts', async () => {
    const { echo, kv } = this.deployment
    return await Promise.all([echo, kv])
  })

}

export default new MyProject()
