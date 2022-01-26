export * from './ScrtAgentJS_1_2'
export * from './ScrtContract_1_2'
export * from './DockerizedScrtNode_1_2'

import { AugmentedScrtContract_1_2 } from './ScrtContract_1_2'

import { ScrtAgentJS_1_2 } from './ScrtAgentJS_1_2'
import { DockerizedScrtNode_1_2 } from './DockerizedScrtNode_1_2'
import { ChainConnectOptions } from '@fadroma/ops'
import { Scrt } from '@fadroma/scrt'

const {
  SCRT_API_URL,
  SCRT_AGENT_NAME,
  SCRT_AGENT_ADDRESS,
  SCRT_AGENT_MNEMONIC
} = process.env

export const Chains = {

  /** Create an instance that runs a node in a local Docker container
   *  and talks to it via SecretJS */
  ['localnet-1.2'] (options: ChainConnectOptions = {}): Scrt {
    // no default agent name/address/mnemonic:
    // connect() gets them from genesis accounts
    return new Scrt({
      isLocalnet: true,
      ...options,
      node:    options.node    || new DockerizedScrtNode_1_2(options),
      chainId: options.chainId || 'supernova-1',
      apiURL:  options.apiURL  || new URL('http://localhost:1337'),
      Agent:   ScrtAgentJS_1_2,
      defaultIdentity: 'ADMIN'
    })
  }

  /** Create an instance that talks to to the Secret Network mainnet via secretcli */
  ['secret-3'] (options: ChainConnectOptions = {}): Scrt {
    const {
      chainId = 'secret-3',
      apiKey  = '5043dd0099ce34f9e6a0d7d6aa1fa6a8',
      apiURL  = new URL(SCRT_API_URL||`https://secret-3--lcd--full.datahub.figment.io/apikey/${apiKey}/`),
      defaultIdentity = {
        name:     SCRT_AGENT_NAME,
        address:  SCRT_AGENT_ADDRESS,
        mnemonic: SCRT_AGENT_MNEMONIC
      }
    } = options
    return new Scrt({
      isMainnet: true,
      chainId,
      apiURL,
      defaultIdentity,
      Agent: ScrtAgentJS_1_2
    })
  },

  /** Create an instance that talks to to supernova-1 testnet via SecretJS */
  ['supernova-1'] (options: ChainConnectOptions = {}): Scrt {
    const {
      chainId = 'supernova-1',
      apiURL  = new URL(SCRT_API_URL||'http://bootstrap.supernova.enigma.co'),
      defaultIdentity = {
        name:     SCRT_AGENT_NAME,
        address:  SCRT_AGENT_ADDRESS  || 'secret1vdf2hz5f2ygy0z7mesntmje8em5u7vxknyeygy',
        mnemonic: SCRT_AGENT_MNEMONIC || 'genius supply lecture echo follow that silly meadow used gym nerve together'
      }
    } = options
    const isTestnet = true
    const Agent = ScrtAgentJS_1_2
    return new Scrt({ isTestnet, chainId, apiURL, defaultIdentity, Agent })
  },

  /** Create an instance that talks to to pulsar-1 testnet via SecretJS */
  ['pulsar-1'] (options: ChainConnectOptions = {}): Scrt {
    const {
      chainId = 'pulsar-1',
      apiURL  = new URL(SCRT_API_URL||'http://testnet.securesecrets.org:1317'),
      defaultIdentity = {
        name:     SCRT_AGENT_NAME,
        address:  SCRT_AGENT_ADDRESS  || 'secret1vdf2hz5f2ygy0z7mesntmje8em5u7vxknyeygy',
        mnemonic: SCRT_AGENT_MNEMONIC || 'genius supply lecture echo follow that silly meadow used gym nerve together'
      }
    } = options
    const isTestnet = true
    const Agent = ScrtAgentJS_1_2
    return new Scrt({ isTestnet, chainId, apiURL, defaultIdentity, Agent })
  },

  /** Create an instance that talks to to pulsar-1 testnet via SecretJS */
  ['pulsar-2'] (options: ChainConnectOptions = {}): Scrt {
    const {
      chainId = 'pulsar-2',
      apiURL  = new URL(SCRT_API_URL||'http://testnet.securesecrets.org:1317'),
      defaultIdentity = {
        name:     SCRT_AGENT_NAME,
        address:  SCRT_AGENT_ADDRESS  || 'secret1vdf2hz5f2ygy0z7mesntmje8em5u7vxknyeygy',
        mnemonic: SCRT_AGENT_MNEMONIC || 'genius supply lecture echo follow that silly meadow used gym nerve together'
      }
    } = options
    const isTestnet = true
    const Agent = ScrtAgentJS_1_2
    return new Scrt({ isTestnet, chainId, apiURL, defaultIdentity, Agent })
  },

}

export default {
  Node:     DockerizedScrtNode_1_2,
  Agent:    ScrtAgentJS_1_2,
  Contract: AugmentedScrtContract_1_2,
  Chains
}
