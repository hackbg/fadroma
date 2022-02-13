import { Console, colors, bold, timestamp } from '@fadroma/ops'

const console = Console('@fadroma/scrt/ScrtBundle')

import pako from 'pako'
import { SigningCosmWasmClient } from 'secretjs'

import {
  Agent, Bundle, BundleResult,
  Contract, Artifact, Template, Instance,
  readFile, writeFile,
  toBase64
} from '@fadroma/ops'

import { ScrtGas } from './ScrtCore'
import type { Scrt, ScrtNonce } from './ScrtChain'
import type { ScrtAgent } from './ScrtAgent'
import type { ScrtAgentJS } from './ScrtAgentJS'

export class ScrtBundle extends Bundle {

  get chain (): Scrt { return super.chain }

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
    console.info(bold('Adding message to bundle:'))
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

  static bundleCounter = 0

  async submit (name: string): Promise<BundleResult[]> {

    // number of bundle, just for identification in console
    const N = ++ScrtBundle.bundleCounter

    name = name || `TX.${N}.${timestamp()}`

    // get signer's account number and sequence via the canonical API
    const { accountNumber, sequence } = await this.nonce

    // the base Bundle class stores messages
    // as (immediately resolved) promises
    const msgs = await Promise.all(this.msgs)

    // print the body of the bundle
    console.info(bold(`Body of bundle`), `#${N}:`)
    console.log()
    console.log(JSON.stringify(msgs))
    console.log()

    this.saveBundle({ N, name }, { accountNumber, sequence }, {
      "type": "cosmos-sdk/StdTx",
      value: {
        msg: msgs,
        fee: new ScrtGas(10000000),
        signatures: null,
        memo: name
      }
    })

    return []

  }

  private async saveBundle ({ N, name }, { accountNumber, sequence }, bundle) {
    const unsignedFilename = `${name}.unsigned.json`
    const signedFilename = `${name}.signed.${timestamp()}.json`
    const output = this.chain.transactions.resolve(unsignedFilename)
    await writeFile(output, JSON.stringify(bundle, null, 2))
    console.log()
    console.info(bold(`Wrote bundle ${N} to:`), output)
    console.log()
    console.info(bold(`Sign bundle ${N} with this command:`))
    console.log()
    const {address, chain:{id}} = this
    console.log(`
  secretcli tx sign ${unsignedFilename} --offline \\
                    --from=YOUR_MULTISIG_MEMBER_ACCOUNT_NAME_HERE \\
                    --multisig=${address} \\
                    --chain-id=${id} --account-number=${accountNumber} --sequence=${sequence} \\
                    --output-document=${signedFilename}`)
    console.log()
    return []
  }

  private get nonce (): Promise<ScrtNonce> {
    return this.chain.getNonce(this.agent.address)
  }

  query = (...args) => {
    throw new Error("@fadroma/scrt/Bundle: can't query from a bundle")
  }
}
