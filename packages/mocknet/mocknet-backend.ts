import * as Fadroma from '@fadroma/client'
import { bech32, randomBech32, sha256, base16 } from '@hackbg/formati'
import { CustomConsole, bold } from '@hackbg/konzola'

const log = new CustomConsole('Fadroma.Mocknet')

/** Hosts MocknetContract instances. */
export default class MocknetBackend {
  /** Hosts an instance of a WASM code blob and its local storage. */
  static Contract: typeof MocknetContract

  constructor (
    readonly chainId:   string,
    readonly uploads:   Record<Fadroma.CodeId, unknown>          = {},
    readonly instances: Record<Fadroma.Address, MocknetContract> = {},
  ) {
    if (Object.keys(uploads).length > 0) {
      this.codeId = (Math.max(...Object.keys(uploads).map(x=>Number(x))) ?? 0) + 1
    }
  }
  codeId = 0
  codeIdForCodeHash: Record<Fadroma.CodeHash, Fadroma.CodeId> = {}
  codeIdForAddress:  Record<Fadroma.Address,  Fadroma.CodeId> = {}
  labelForAddress:   Record<Fadroma.Address,  Fadroma.Label>  = {}
  getCode (codeId: Fadroma.CodeId) {
    const code = this.uploads[codeId]
    if (!code) throw new Error(`No code with id ${codeId}`)
    return code
  }
  upload (blob: Uint8Array) {
    const chainId  = this.chainId
    const codeId   = String(++this.codeId)
    const content  = this.uploads[codeId] = blob
    const codeHash = codeHashForBlob(blob)
    this.codeIdForCodeHash[codeHash] = String(codeId)
    return { codeId, codeHash }
  }
  getInstance (address?: Fadroma.Address) {
    if (!address) {
      throw new Error(`MocknetBackend#getInstance: can't get instance without address`)
    }
    const instance = this.instances[address]
    if (!instance) {
      throw new Error(`MocknetBackend#getInstance: no contract at ${address}`)
    }
    return instance
  }
  async instantiate (
    sender:   Fadroma.Address,
    instance: Fadroma.ContractInstance
  ): Promise<Partial<Fadroma.ContractInstance>> {
    const label    = instance.label
    const initMsg  = await Fadroma.into(instance.initMsg)
    const chainId  = this.chainId
    const code     = this.getCode(instance.codeId!)
    const contract = await new MocknetBackend.Contract(this).load(code, instance.codeId)
    const env      = this.makeEnv(sender, contract.address, instance.codeHash)
    const response = contract.init(env, initMsg!)
    const initResponse = parseResult(response, 'instantiate', contract.address)
    this.instances[contract.address]        = contract
    this.codeIdForAddress[contract.address] = instance.codeId!
    this.labelForAddress[contract.address]  = label!
    await this.passCallbacks(contract.address, initResponse.messages)
    return {
      address:  contract.address,
      chainId,
      codeId:   instance.codeId,
      codeHash: instance.codeHash,
      label
    }
  }
  async execute (
    sender: Fadroma.Address,
    { address, codeHash }: Partial<Fadroma.Client>,
    msg: Fadroma.Message,
    funds: unknown,
    memo?: unknown, 
    fee?:  unknown
  ) {
    const result   = this.getInstance(address).handle(this.makeEnv(sender, address), msg)
    const response = parseResult(result, 'execute', address)
    if (response.data !== null) {
      response.data = b64toUtf8(response.data)
    }
    await this.passCallbacks(address, response.messages)
    return response
  }
  /** Populate the `Env` object available in transactions. */
  makeEnv (
    sender:   Fadroma.Address,
    address?: Fadroma.Address,
    codeHash: Fadroma.CodeHash|undefined = address ? this.instances[address]?.codeHash : undefined,
    now: number = + new Date()
  ) {
    if (!address) {
      throw new Error("MocknetBackend#makeEnv: Can't create contract environment without address")
    }
    const height            = Math.floor(now/5000)
    const time              = Math.floor(now/1000)
    const chain_id          = this.chainId
    const sent_funds: any[] = []
    return {
      block:    { height, time, chain_id },
      message:  { sender, sent_funds },
      contract: { address },
      contract_key: "",
      contract_code_hash: codeHash
    }
  }
  async passCallbacks (sender: Fadroma.Address|undefined, messages: Array<any>) {
    if (!sender) {
      throw new Error("MocknetBackend#passCallbacks: can't pass callbacks without sender")
    }
    for (const message of messages) {
      const { wasm } = message
      if (!wasm) {
        log.warn(
          'MocknetBackend#execute: transaction returned non-wasm message, ignoring:',
          message
        )
        continue
      }
      const { instantiate, execute } = wasm
      if (instantiate) {
        const { code_id: codeId, callback_code_hash: codeHash, label, msg, send } = instantiate
        const instance = await this.instantiate(sender, new Fadroma.ContractInstance({
          codeHash, codeId, label, initMsg: JSON.parse(b64toUtf8(msg)),
        }))
        trace(
          `Callback from ${bold(sender)}: instantiated contract`, bold(label),
          'from code id', bold(codeId), 'with hash', bold(codeHash),
          'at address', bold(instance.address!)
        )
      } else if (execute) {
        const { contract_addr, callback_code_hash, msg, send } = execute
        const response = await this.execute(
          sender,
          { address: contract_addr, codeHash: callback_code_hash },
          JSON.parse(b64toUtf8(msg)),
          send
        )
        trace(
          `Callback from ${bold(sender)}: executed transaction`,
          'on contract', bold(contract_addr), 'with hash', bold(callback_code_hash),
        )
      } else {
        log.warn(
          'MocknetBackend#execute: transaction returned wasm message that was not '+
          '"instantiate" or "execute", ignoring:',
          message
        )
      }
    }
  }
  async query ({ address, codeHash }: Partial<Fadroma.Client>, msg: Fadroma.Message) {
    const result = b64toUtf8(parseResult(this.getInstance(address).query(msg), 'query', address))
    return JSON.parse(result)
  }

}
