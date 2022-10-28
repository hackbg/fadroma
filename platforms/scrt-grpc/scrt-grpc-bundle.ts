import { Scrt, ScrtConsole, ScrtBundle } from '@fadroma/scrt'
import type { Address, TxHash, ChainId, CodeId, CodeHash, Label } from '@fadroma/scrt'
import type { ScrtGrpc } from './scrt-grpc-chain'
import type { ScrtGrpcAgent } from './scrt-grpc-agent'

export interface ScrtBundleResult {
  sender?:   Address
  tx:        TxHash
  type:      'wasm/MsgInstantiateContract'|'wasm/MsgExecuteContract'
  chainId:   ChainId
  codeId?:   CodeId
  codeHash?: CodeHash
  address?:  Address
  label?:    Label
}

export class ScrtGrpcBundle extends ScrtBundle {
  log = new ScrtConsole('ScrtGrpcBundle')

  constructor (agent: ScrtGrpcAgent) {
    super(agent)
    // Optional: override SecretJS implementation
    Object.defineProperty(this, 'SecretJS', { enumerable: false, writable: true })
  }

  /** The agent which will broadcast the bundle. */
  declare agent: ScrtGrpcAgent

  async submit (memo = ""): Promise<ScrtBundleResult[]> {
    const SecretJS = (this.agent?.chain as ScrtGrpc).SecretJS ?? await import('secretjs')
    const chainId = this.assertChain().id
    const results: ScrtBundleResult[] = []
    const msgs  = await this.conformedMsgs
    const limit = Number(Scrt.defaultFees.exec.amount[0].amount)
    const gas   = msgs.length * limit
    try {
      const agent = this.agent as unknown as ScrtGrpcAgent
      const txResult = await agent.api.tx.broadcast(msgs, { gasLimit: gas })
      if (txResult.code !== 0) {
        const error = `(in bundle): gRPC error ${txResult.code}: ${txResult.rawLog}`
        throw Object.assign(new Error(error), txResult)
      }
      for (const i in msgs) {
        const msg = msgs[i]
        const result: Partial<ScrtBundleResult> = {}
        result.sender  = this.address
        result.tx      = txResult.transactionHash
        result.chainId = chainId
        if (msg instanceof SecretJS.MsgInstantiateContract) {
          type Log = { msg: number, type: string, key: string }
          const findAddr = ({msg, type, key}: Log) =>
            msg  ==  Number(i) &&
            type === "message" &&
            key  === "contract_address"
          result.type    = 'wasm/MsgInstantiateContract'
          result.codeId  = msg.codeId
          result.label   = msg.label
          result.address = txResult.arrayLog?.find(findAddr)?.value
        }
        if (msg instanceof SecretJS.MsgExecuteContract) {
          result.type    = 'wasm/MsgExecuteContract'
          result.address = msg.contractAddress
        }
        results[Number(i)] = result as ScrtBundleResult
      }
    } catch (err) {
      this.log.submittingBundleFailed(err)
      throw err
    }
    return results
  }

  async simulate () {
    const { api } = this.agent as ScrtGrpcAgent
    return await api.tx.simulate(await this.conformedMsgs)
  }

  /** Format the messages for API v1 like secretjs and encrypt them. */
  private get conformedMsgs () {
    return Promise.all(this.assertMessages().map(async ({init, exec})=>{
      const SecretJS = (this.agent?.chain as ScrtGrpc).SecretJS ?? await import('secretjs')
      if (init) return new SecretJS.MsgInstantiateContract({
        sender:          init.sender,
        codeId:          init.codeId,
        codeHash:        init.codeHash,
        label:           init.label,
        initMsg:         init.msg,
        initFunds:       init.funds,
      })
      if (exec) return new SecretJS.MsgExecuteContract({
        sender:          exec.sender,
        contractAddress: exec.contract,
        codeHash:        exec.codeHash,
        msg:             exec.msg,
        sentFunds:       exec.funds,
      })
      throw 'unreachable'
    }))
  }

}
