import { Console, bold } from '@fadroma/agent'

export default class DevnetConsole extends Console {

  loadingState = (chainId1: string, chainId2: string) =>
    this.info(`Loading state of ${chainId1} into Devnet with id ${chainId2}`)

  loadingFailed = (path: string) =>
    this.warn(`Failed to load devnet state from ${path}. Deleting it.`)

  loadingRejected = (path: string) =>
    this.info(`${path} does not exist.`)

  devnetIsRunning = (devnet: { port: any, container: { id: string }|null }) => {
    const port = String(devnet.port)
    const id = devnet.container!.id.slice(0,8)
    this.info(`Devnet is running on port ${bold(port)} from container ${bold(id)}.`)
    this.info('Use this command to reset it:')
    this.info(`  docker kill ${id} && sudo rm -rf receipts/fadroma-devnet`)
  }

}
