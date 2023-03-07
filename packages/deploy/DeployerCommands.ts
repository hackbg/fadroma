import { CommandContext } from '@hackbg/cmds'
import type Deployer from './Deployer'

export default class DeployerCommands extends CommandContext {

  constructor (readonly deployer: Deployer) {
    super(deployer.projectName)
    const name  = deployer.name
    const chain = deployer.chain?.id
    if (chain) {
      this.addCommand(
        'list',
        `print a list of all deployments on ${chain}`,
        deployer.listDeployments.bind(deployer)
      ).addCommand(
        'create',
        `create a new empty deployment on ${chain}`,
        deployer.createDeployment.bind(deployer)
      ).addCommand(
        'select',
        `activate another deployment on ${chain}`,
        deployer.selectDeployment.bind(deployer)
      ).addCommand(
        'status',
        `list all contracts in ${name}`,
        deployer.showStatus.bind(deployer)
      ).addCommand(
        'export',
        `export current deployment to ${name}.json`,
        deployer.exportContracts.bind(deployer)
      )
    }
  }

}
