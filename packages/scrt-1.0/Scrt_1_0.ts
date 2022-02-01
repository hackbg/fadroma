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

const console = Console('@fadroma/scrt-1.0')

const {
  SCRT_API_URL,
  SCRT_AGENT_NAME,
  SCRT_AGENT_ADDRESS,
  SCRT_AGENT_MNEMONIC,
  DATAHUB_KEY
} = process.env

export class Scrt_1_0 extends Scrt {
  Agent = ScrtAgentJS_1_0
}

export class Scrt_1_0_Localnet extends Scrt_1_0 {
  isLocalnet = true
  node       = new DockerizedScrtNode_1_0()
  chainId    = 'fadroma-scrt-10'
  apiURL     = new URL('http://localhost:1337')
  defaultIdentity = 'ADMIN'
}

export class DockerizedScrtNode_1_0 extends DockerizedScrtNode {
  readonly chainId: string = 'fadroma-scrt-10'
  readonly image:   string = "enigmampc/secret-network-sw-dev:v1.0.4-5"
  readonly readyPhrase     = 'GENESIS COMPLETE'
  readonly initScript      = new TextFile(__dirname, 'Scrt_1_0_Init.sh')
  constructor (options: ChainNodeOptions = {}) {
    super()
    if (options.image) this.image = options.image
    if (options.chainId) this.chainId = options.chainId
    if (options.identities) this.identitiesToCreate = options.identities
    this.setDirectories(options.stateRoot)
  }
}

export class Scrt_1_0_Testnet extends Scrt_1_0 {
  isTestnet  = true
  chainId    = 'holodeck-2'
  apiURL     = new URL(SCRT_API_URL||'http://96.44.145.210/'),
  defaultIdentity = {
    name:     SCRT_AGENT_NAME,
    address:  SCRT_AGENT_ADDRESS,
    mnemonic: SCRT_AGENT_MNEMONIC
  }
}

export class Scrt_1_0_Mainnet extends Scrt_1_0 {
  isMainnet  = true
  chainId    = 'secret-2'
  apiURL     = new URL(`https://secret-2--lcd--full.datahub.figment.io/apikey/${DATAHUB_KEY}/`)
  defaultIdentity = {
    name:     SCRT_AGENT_NAME,
    address:  SCRT_AGENT_ADDRESS,
    mnemonic: SCRT_AGENT_MNEMONIC
  }
}

export const Chains = {
  /** Create an instance that runs a node in a local Docker container
   *  and talks to it via SecretJS */
  'localnet-1.0': () => new Scrt_1_0_Localnet({}),
  /** Create an instance that talks to holodeck-2 testnet via SecretJS */
  'holodeck-2':   () => new Scrt_1_0_Testnet({}),
  /** Create an instance that talks to to the Secret Network mainnet via secretcli */
  'secret-2':     () => new Scrt_1_0_Mainnet({}),
}

export const __dirname       = dirname(fileURLToPath(import.meta.url))
export const buildImage      = 'hackbg/fadroma-scrt-builder:1.0'
export const buildDockerfile = resolve(__dirname, 'Scrt_1_0_Build.Dockerfile')

export class ScrtContract_1_0 extends BaseContract {
  buildImage      = buildImage
  buildDockerfile = buildDockerfile
  buildScript     = buildScript
}

export class AugmentedScrtContract_1_0<T, Q> extends AugmentedScrtContract<T, Q> {
  buildImage      = buildImage
  buildDockerfile = buildDockerfile
  buildScript     = buildScript
}

export class ScrtAgentJS_1_0 extends ScrtAgentJS {
  static create = (options: Identity): Promise<Agent> =>
    ScrtAgentJS.createSub(ScrtAgentJS_1_0 as unknown as AgentClass, options)
  constructor (options: Identity) {
    super(PatchedSigningCosmWasmClient_1_0, options)
  }
}

export default {
  Node:     DockerizedScrtNode_1_0,
  Agent:    ScrtAgentJS_1_0,
  Contract: AugmentedScrtContract_1_0,
  Chains
}

export class PatchedSigningCosmWasmClient_1_0 extends SigningCosmWasmClient {
  async postTx (tx: any): Promise<any> {
    // only override for non-default broadcast modes
    if ((this.restClient as any).broadcastMode === BroadcastMode.Block) {
      console.info('broadcast mode is block, bypassing patch')
      return super.postTx(tx)
    }
    // try posting the transaction
    let submitRetries = 20
    while (submitRetries--) {
      // get current block number
      const sent = (await this.getBlock()).header.height
      // submit the transaction and get its id
      const submitResult = await super.postTx(tx)
      const id = submitResult.transactionHash
      // wait for next block
      while (true) {
        await new Promise(ok=>setTimeout(ok, 1000))
        const now = (await this.getBlock()).header.height
        //console.debug(id, sent, now)
        if (now > sent) break
      }
      await new Promise(ok=>setTimeout(ok, 1000))
      // once the block has incremented, get the full transaction result
      let resultRetries = 20
      while (resultRetries--) {
        try {
          const result = await this.restClient.get(`/txs/${id}`)
          // if result contains error, throw it
          const {raw_log} = result as any
          if (raw_log.includes('failed')) throw new Error(raw_log)
          Object.assign(result, { transactionHash: id, logs: ((result as any).logs)||[] })
          return result
        } catch (e) {
          // retry only on 404, throw all other errors to decrypt them
          if (!e.message.includes('404')) throw e
          console.warn(`failed to query result of tx ${id} with the following error, ${resultRetries} retries left`)
          console.warn(e)
          await new Promise(ok=>setTimeout(ok, 2000))
          continue
        }
      }
      console.warn(`failed to submit tx ${id}, ${submitRetries} retries left...`)
      await new Promise(ok=>setTimeout(ok, 1000))
    }
  }
  async queryContractSmart (
    addr: string, query: object, params?: object, hash?: string
  ): Promise<any> {
    let retries = 20
    while (retries--) {
      try {
        return super.queryContractSmart(addr, query, params, hash)
      } catch (e) {
        if (isConnectionError(e)) {
          await new Promise(ok=>setTimeout(ok, 2000))
          continue
        } else {
          throw e
        }
      }
    }
  }
}

export const isConnectionError = (e: Error & {code:any}) => (
  e.message.includes('socket hang up') ||
  e.code === 'ECONNRESET'
)
