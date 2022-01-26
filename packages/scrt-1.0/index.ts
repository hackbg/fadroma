export * from './ScrtAgentJS_1_0'
export * from './ScrtContract_1_0'
export * from './DockerizedScrtNode_1_0'

import { AugmentedScrtContract_1_0 } from './ScrtContract_1_0'

import { ScrtAgentJS_1_0 } from './ScrtAgentJS_1_0'
import { DockerizedScrtNode_1_0 } from './DockerizedScrtNode_1_0'
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
  ['localnet-1.0'] (options: ChainConnectOptions = {}): Scrt {
    // no default agent name/address/mnemonic:
    // connect() gets them from genesis accounts
    return new Scrt({
      isLocalnet: true,
      node:    options.node    || new DockerizedScrtNode_1_0({ identities: options.identities }),
      chainId: options.chainId || 'enigma-pub-testnet-3',
      apiURL:  options.apiURL  || new URL('http://localhost:1337'),
      Agent:   ScrtAgentJS_1_0,
      defaultIdentity: 'ADMIN'
    })
  },

  /** Create an instance that talks to to the Secret Network mainnet via secretcli */
  ['secret-2'] (options: ChainConnectOptions = {}): Scrt {
    const {
      chainId = 'secret-2',
      apiKey  = '5043dd0099ce34f9e6a0d7d6aa1fa6a8',
      apiURL  = new URL(SCRT_API_URL||`https://secret-2--lcd--full.datahub.figment.io/apikey/${apiKey}/`),
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
      Agent: ScrtAgentJS_1_0
    })
  },

  /** Create an instance that talks to holodeck-2 testnet via SecretJS */
  ['holodeck-2'] (options: ChainConnectOptions = {}): Scrt {
    const {
      //chainId = 'holodeck-2',
      apiURL  = new URL(SCRT_API_URL||'http://96.44.145.210/'),
      chainId = 'holodeck-2',
      //apiKey  = '5043dd0099ce34f9e6a0d7d6aa1fa6a8',
      //apiURL  = new URL(`https://secret-holodeck-2--lcd--full.datahub.figment.io:443/apikey/${apiKey}/`),
      defaultIdentity = {
        name:     SCRT_AGENT_NAME,
        address:  SCRT_AGENT_ADDRESS  || 'secret1vdf2hz5f2ygy0z7mesntmje8em5u7vxknyeygy',
        mnemonic: SCRT_AGENT_MNEMONIC || 'genius supply lecture echo follow that silly meadow used gym nerve together'
      }
    } = options
    const isTestnet = true
    const Agent = ScrtAgentJS_1_0
    return new Scrt({ isTestnet, chainId, apiURL, defaultIdentity, Agent })
  },

}

export default {
  Node:     DockerizedScrtNode_1_0,
  Agent:    ScrtAgentJS_1_0,
  Contract: AugmentedScrtContract_1_0,
  Chains
}
