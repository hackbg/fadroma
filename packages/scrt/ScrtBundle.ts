import { Console, colors, bold, timestamp } from '@fadroma/ops'
const console = Console('@fadroma/scrt/ScrtBundle')

import pako from 'pako'
import { SigningCosmWasmClient } from 'secretjs'

import {
  Agent, Bundle, BundleResult,
  Contract, Artifact, Template, Instance,
  readFile,
  toBase64
} from '@fadroma/ops'

import { ScrtGas } from './ScrtCore'
import type { ScrtAgent } from './ScrtAgent'
import type { ScrtAgentJS } from './ScrtAgentJS'

export class ScrtBundle extends Bundle {

  constructor (readonly agent: ScrtAgent) { super(agent as Agent) }

  upload ({ location }: Artifact) {
    this.add(readFile(location).then(wasm=>({
      type: 'wasm/MsgStoreCode',
      value: {
        sender:         this.address,
        wasm_byte_code: toBase64(pako.gzip(wasm, { level: 9 }))
      }
    })))
    return this
  }

  init ({ codeId, codeHash }: Template, label, msg, init_funds = []) {
    const sender  = this.address
    const code_id = String(codeId)
    this.add(this.encrypt(codeHash, msg).then(init_msg=>({
      type: 'wasm/MsgInstantiateContract',
      value: { sender, code_id, init_msg, label, init_funds }
    })))
    return this
  }

  async instantiate (template: Template, label, msg, init_funds = []) {
    await this.init(template, label, msg, init_funds)
    const { codeId, codeHash } = template
    return { chainId: this.agent.chain.id, codeId, codeHash }
  }

  async instantiateMany (
    contracts: [Contract<any>, any?, string?, string?][],
    prefix?:   string
  ): Promise<Instance[]> {
    for (const [
      contract,
      msg    = contract.initMsg,
      name   = contract.name,
      suffix = contract.suffix
    ] of contracts) {
      // if custom contract properties are passed to instantiate,
      // set them on the contract class. FIXME this is a mutation,
      // the contract class should not exist, this function should
      // take `Template` instead of `Contract`
      contract.initMsg = msg
      contract.name    = name
      contract.suffix  = suffix

      // generate the label here since `get label () {}` is no more
      let label = `${name}${suffix||''}`
      if (prefix) label = `${prefix}/${label}`
      console.info(bold('Instantiate:'), label)

      // add the init tx to the bundle. when passing a single contract
      // to instantiate, this should behave equivalently to non-bundled init
      const template = contract.template || {
        chainId:  contract.chainId,
        codeId:   contract.codeId,
        codeHash: contract.codeHash
      }
      await this.instantiate(template, label, msg)
    }
    return contracts.map(contract=>contract[0].instance)
  }

  execute ({ address, codeHash }: Instance, msg, sent_funds = []) {
    const sender   = this.address
    const contract = address
    console.info(bold('Adding message to multisig:'))
    console.log()
    console.log(JSON.stringify(msg))
    console.log()
    this.add(this.encrypt(codeHash, msg).then(msg=>({
      type: 'wasm/MsgExecuteContract',
      value: { sender, contract, msg, sent_funds }
    })))
    return this
  }

  private async encrypt (codeHash, msg) {
    return (this.agent as ScrtAgentJS).encrypt(codeHash, msg)
  }

  async submit (memo = ""): Promise<BundleResult[]> {
    const tempClient = new SigningCosmWasmClient(
      this.chain.url,
      this.address,
      () => {throw new Error('nope')}
    )
    const { accountNumber, sequence } = await tempClient.getNonce()

    console.info(bold('Multisig transaction body:'))
    console.log()
    console.log(JSON.stringify({
      chain_id:       this.agent.chain.id,
      account_number: accountNumber,
      sequence:       sequence,
      fee:            new ScrtGas(10000000),
      msgs:           await Promise.all(this.msgs),
      memo:           `${timestamp()}`
    }))
    console.log()

    return []
  }
}
