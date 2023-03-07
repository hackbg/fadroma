import { ClientError } from '@fadroma/core'

export default class ConnectError extends ClientError {

  static SelectChainHint =
    `Try setting the FADROMA_CHAIN env var to one of the supported values.`

  static UnknownChainSelected = this.define('UnknownChainSelected',
    (name: string, chains?: Record<string, unknown>)=>{
      //chains && log.supportedChains(chains)
      return `Unknown chain "${name}". ${ConnectError.SelectChainHint}`
    })

  static NoChainSelected = this.define('NoChainSelected',
    (chains?: Record<string, unknown>)=>{
      //chains && log.supportedChains(chains)
      return `No chain selected. ${ConnectError.SelectChainHint}`
    })

}
