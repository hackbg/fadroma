import { DeployConsole } from '@fadroma/ops'

export default class Console extends DeployConsole {
  constructor (name = 'Fadroma') {
    super(name)
  }
}
