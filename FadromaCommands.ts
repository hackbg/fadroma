import Fadroma from './Fadroma'
import { projectWizard } from '@fadroma/project'
import { CommandContext } from '@hackbg/cmds'

export default class FadromaCommands extends CommandContext {
  constructor (
    readonly fadroma: Fadroma = new Fadroma()
  ) {
    super()
    this.addCommand('create', 'create a new project', projectWizard)
        //.addCommands('chain', 'manage chains and connections', new ChainCommands())
        //.addCommands('contract', 'manage contracts', new ContractCommands())
        //.addCommands('deployment', 'manage contracts', new DeploymentCommands())
        //.addCommands('token', 'manage token contracts', new TokensCommands())
  }
}
