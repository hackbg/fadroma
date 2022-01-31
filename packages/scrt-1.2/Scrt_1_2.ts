import { SigningCosmWasmClient, BroadcastMode } from 'secretjs'
import { URL } from 'url'
import {
  Console,
  ScrtAgentJS, Identity, Agent,
  BaseContract, AugmentedScrtContract,
  buildScript, resolve, dirname, fileURLToPath,
  DockerizedScrtNode, ChainNodeOptions,
  Scrt, ChainConnectOptions,
  TextFile,
} from '@fadroma/scrt'

const console = Console('@fadroma/scrt-1.2')

const {
  SCRT_API_URL,
  SCRT_API_KEY,
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
      chainId: options.chainId || 'fadroma-scrt-12',
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

  /** Create an instance that talks to to the Secret Network mainnet via secretcli */
  ['secret-4'] (options: ChainConnectOptions = {}): Scrt {
    const {
      chainId = 'secret-4',
      apiKey  = '5043dd0099ce34f9e6a0d7d6aa1fa6a8',
      apiURL  = new URL(SCRT_API_URL||`https://secret-4--lcd--full.datahub.figment.io/apikey/${apiKey}/`),
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
      apiKey  = SCRT_API_KEY||'5043dd0099ce34f9e6a0d7d6aa1fa6a8',
      apiURL  = new URL(SCRT_API_URL||`https://secret-pulsar-2--lcd--full.datahub.figment.io/apikey/${apiKey}/`),
      defaultIdentity = {
        name:     SCRT_AGENT_NAME,
        address:  SCRT_AGENT_ADDRESS  || 'secret1vdf2hz5f2ygy0z7mesntmje8em5u7vxknyeygy',
        mnemonic: SCRT_AGENT_MNEMONIC || 'genius supply lecture echo follow that silly meadow used gym nerve together'
      }
    } = options
    console.log({apiKey})
    const isTestnet = true
    const Agent = ScrtAgentJS_1_2
    return new Scrt({ isTestnet, chainId, apiURL, defaultIdentity, Agent })
  },

}

export class PatchedSigningCosmWasmClient_1_2 extends SigningCosmWasmClient {
  submitRetries      = 10
  resubmitDelay      = 1000
  blockQueryInterval = 1000
  resultRetries      = 10
  resultRetryDelay   = 2000
  async postTx (tx: any): Promise<any> {
    // Only override for non-default broadcast modes
    if (this.restClient.broadcastMode === BroadcastMode.Block) {
      console.info('Broadcast mode is block, bypassing patch')
      return super.postTx(tx)
    }
    let submitRetries = this.submitRetries
    while (submitRetries--) {
      // 1. Submit the transaction
      const sent = (await this.getBlock()).header.height
      const {transactionHash: id} = await super.postTx(tx)
      // 2. Poll for block height to increment
      await this.waitForNextBlock(sent)
      // 3. Start querying for the full result.
      try {
        return await this.getTxResult(id)
      } catch (error) {
        if (error.rethrow) {
          // 4. If the transaction resulted in an error, rethrow it so it can be decrypted
          console.warn(`Transaction ${id} returned error:\n${error.message}`)
          throw error
        } else {
          // 5. If the transaction simply hasn't committed yet, query for the result again.
          console.info(`Submit tx: ${submitRetries} retries left...`)
          await new Promise(ok=>setTimeout(ok, this.resubmitDelay))
        }
      }
    }
  }
  async waitForNextBlock (sent: number) {
    while (true) {
      await new Promise(ok=>setTimeout(ok, this.blockQueryInterval))
      const now = (await this.getBlock()).header.height
      if (now > sent) break
    }
  }
  async getTxResult (id: string) {
    let resultRetries = this.resultRetries
    while (resultRetries--) {
      try {
        //console.info(`Requesting result of tx ${id}`)
        const result = await this.restClient.get(`/txs/${id}`)
        // if result contains error, throw it so it can be decrypted
        const {raw_log, logs = []} = result as any
        if (raw_log.includes('failed') || raw_log.includes('out of gas')) {
          console.warn(`Transaction ${id} failed`, result)
          const error = new Error(raw_log)
          Object.assign(error, { rethrow: true })
          throw new Error(raw_log)
        }
        Object.assign(result, { transactionHash: id, logs })
        return result
      } catch (error) {
        // retry only on 404, throw all other errors to decrypt them
        if (!error.message.includes('404')) {
          Object.assign(error, { rethrow: true })
          throw error
        }
        if (process.env.FADROMA_PRINT_TXS) {
          console.warn(`Failed to query result of tx ${id}: ${error.message}`)
          console.info(`Requesting result of ${id}: ${resultRetries} retries left`)
        }
        await new Promise(ok=>setTimeout(ok, this.resultRetryDelay))
        continue
      }
    }
  }
  async instantiate (...args: Array<any>) {
    let {transactionHash:id} = await super.instantiate(...args)
    return await this.getTxResult(id)
  }
  async execute (...args: Array<any>) {
    let {transactionHash:id} = await super.execute(...args)
    return await this.getTxResult(id)
  }
}

export class ScrtAgentJS_1_2 extends ScrtAgentJS {
  static create = (options: Identity): Promise<Agent> =>
    ScrtAgentJS.createSub(ScrtAgentJS_1_2, options)
  constructor (options: Identity) {
    super(PatchedSigningCosmWasmClient_1_2, options)
  }
  async upload (pathToBinary: string) {
    const result = await super.upload(pathToBinary)
    // Non-blocking broadcast mode returns code ID = -1,
    // so we need to find the code ID manually from the output
    if (result.codeId === -1) {
      try {
        for (const log of result.logs) {
          for (const event of log.events) {
            for (const attribute of event.attributes) {
              if (attribute.key === 'code_id') {
                Object.assign(result, { codeId: Number(attribute.value) })
                break
              }
            }
          }
        }
      } catch (e) {
        console.warn(`Could not get code ID for ${bold(pathToBinary)}: ${e.message}`)
        console.debug(`Result of upload transaction:`, result)
        throw e
      }
    }
    return result
  }
}

export const __dirname       = dirname(fileURLToPath(import.meta.url)),
export const buildImage      = 'hackbg/fadroma-scrt-builder:1.2',
export const buildDockerfile = resolve(__dirname, 'Scrt_1_2_Build.Dockerfile')

export class ScrtContract_1_2 extends BaseContract {
  buildImage      = buildImage
  buildDockerfile = buildDockerfile
  buildScript     = buildScript
}

export class AugmentedScrtContract_1_2<T, Q> extends AugmentedScrtContract<T, Q> {
  buildImage      = buildImage
  buildDockerfile = buildDockerfile
  buildScript     = buildScript
}

export class DockerizedScrtNode_1_2 extends DockerizedScrtNode {
  readonly chainId: string = 'supernova-1'
  readonly image:   string = "enigmampc/secret-network-sw-dev:v1.2.0"
  readonly readyPhrase = 'indexed block'
  readonly initScript = new TextFile(__dirname, 'Scrt_1_2_Init.sh')
  constructor (options: ChainNodeOptions = {}) {
    super()
    if (options.image) this.image = options.image
    if (options.chainId) this.chainId = options.chainId
    if (options.identities) this.identitiesToCreate = options.identities
    this.setDirectories(options.stateRoot)
  }
}

export default {
  Node:     DockerizedScrtNode_1_2,
  Agent:    ScrtAgentJS_1_2,
  Contract: AugmentedScrtContract_1_2,
  Chains
}
