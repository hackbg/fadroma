import { Error } from '@fadroma/agent'

export default class ConnectError extends Error {

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
