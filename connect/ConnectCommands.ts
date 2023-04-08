import ConnectConfig from './ConnectConfig'

import { CommandContext } from '@hackbg/cmds'

export default class ConnectCommands extends CommandContext {

  constructor (
    public config: ConnectConfig = new ConnectConfig()
  ) {

    super('@fadroma/connect')

    this.addCommand('list', 'print a list of all known chains', () => {
      config.listChains()
    })

    //if (connector.chain?.node instanceof DevnetContainer) {
      //const devnet = connector.chain.node as unknown as DevnetContainer
      //this.addCommand(
        //'export',
        //'export the current devnet as a new Docker image',
        //(...args) => devnet.export(...args)
      //).addCommand(
        //'kill',
        //'terminate the devnet immediately',
        //devnet.kill.bind(devnet)
      //).addCommand(
        //'reset',
        //'kill and erase the devnet',
        //devnet.terminate.bind(devnet)
      //)
    //}
  }

}
