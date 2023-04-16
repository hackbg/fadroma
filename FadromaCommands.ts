import { CommandContext } from '@hackbg/cmds'
import { Deployment } from '@fadroma/agent'
import {
  getBuilder,
  getProject,
  projectWizard,
  DevnetCommands,
} from '@fadroma/ops'

export default class FadromaCommands extends CommandContext {
  constructor (readonly deployment?: Deployment) {
    super()
    this.addCommand('run', 'execute a script',
      () => { throw new Error('not implemented') })
    //this.addCommand('upload', 'upload a contract from the current project',
      //() => { throw new Error('not implemented') })
    //this.addCommand('init',   'instantiate a contract into the current deployment',
      //() => { throw new Error('not implemented') })
    //this.addCommand('tx',     'transact with a contract from the current deployment',
      //() => { throw new Error('not implemented') })
    //this.addCommand('q',      'query a contract from the current deployment',
      //() => { throw new Error('not implemented') })
        //.addCommands('chain', 'manage chains and connections', new ChainCommands())
        //.addCommands('contract', 'manage contracts', new ContractCommands())
        //.addCommands('deployment', 'manage contracts', new DeploymentCommands())
        //.addCommands('token', 'manage token contracts', new TokensCommands())
  }
  devnet = this.commands(
    'devnet',
    'manage local development containers',
    new DevnetCommands()
  )
  project = this.commands(
    'project',
    'manage projects',
    new ProjectCommands()
  )
  contract = this.commands(
    'contract',
    'manage contracts in this project',
    new ContractCommands()
  )
}

export class ProjectCommands extends CommandContext {
  create = this.command('create', 'create a new project', projectWizard)
}

export class ContractCommands extends CommandContext {
  define = this.command('define', 'define a contract in the current project',
    () => { throw new Error('not implemented') })

  build = this.command('build', 'compile a contract from the current project', (name) => {
    if (name) {
      const project = getProject()
      const builder = getBuilder()
      return builder.build(project.getContract(name) as any)
    }
  })
}
