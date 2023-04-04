import Fadroma from './Fadroma'
import { getBuilder, getProject, projectWizard } from '@fadroma/ops'
import { CommandContext } from '@hackbg/cmds'

export default class FadromaCommands extends CommandContext {
  constructor (
    readonly fadroma: Fadroma = new Fadroma()
  ) {
    super()

    this.addCommand('run', 'execute a script',
      () => { throw new Error('not implemented') })

    this.addCommand('create', 'create a new project',
      projectWizard)

    this.addCommand('define', 'define a contract in the current project',
      () => { throw new Error('not implemented') })

    this.addCommand('build',  'compile a contract from the current project', (name) => {
      if (name) {
        const project = getProject()
        const builder = getBuilder()
        return builder.build(project.getContract(name) as any)
      }
    })

    this.addCommand('upload', 'upload a contract from the current project',
      () => { throw new Error('not implemented') })

    this.addCommand('init',   'instantiate a contract into the current deployment',
      () => { throw new Error('not implemented') })

    this.addCommand('tx',     'transact with a contract from the current deployment',
      () => { throw new Error('not implemented') })

    this.addCommand('q',      'query a contract from the current deployment',
      () => { throw new Error('not implemented') })

        //.addCommands('chain', 'manage chains and connections', new ChainCommands())
        //.addCommands('contract', 'manage contracts', new ContractCommands())
        //.addCommands('deployment', 'manage contracts', new DeploymentCommands())
        //.addCommands('token', 'manage token contracts', new TokensCommands())
  }
}
