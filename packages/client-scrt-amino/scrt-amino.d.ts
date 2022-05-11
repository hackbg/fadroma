declare module '@fadroma/client-scrt-amino' {

  import {
    AgentOptions, Fees, Template, Instance,
    ScrtGas, ScrtChain, ScrtAgent, ScrtBundle, ScrtBundleResult,
    mergeAttrs
  } from '@fadroma/client-scrt'

  import { toBase64, fromBase64, fromUtf8, fromHex } from '@iov/encoding'

  import { Bip39 } from '@cosmjs/crypto'

  import { ExecuteResult } from 'secretjs'

  export interface ScrtNonce {
    accountNumber: number
    sequence:      number
  }

  interface SigningPen {
    pubkey: Uint8Array,
    sign:   Function
  }

  export interface LegacyScrtAgentOptions extends AgentOptions {
    keyPair?: { privkey: Uint8Array }
    pen?:     SigningPen
    fees?:    Fees
  }

  export class LegacyScrtAgent extends ScrtAgent {

    Bundle: LegacyScrtBundle

    static create (chain: LegacyScrt, options: LegacyScrtAgentOptions): Promise<LegacyScrtAgent>

    constructor (chain: LegacyScrt, options: LegacyScrtAgentOptions)

    readonly keyPair:  any

    readonly mnemonic: any

    readonly pen:      SigningPen

    readonly sign:     any

    readonly pubkey:   any

    readonly seed:     any

    API: typeof PatchedSigningCosmWasmClient_1_2

    get api (): PatchedSigningCosmWasmClient_1_2

    get block (): unknown

    get account (): unknown

    send (recipient: any, amount: string|number, denom, memo): unknown

    sendMany (txs, memo, denom, fee): unknown

    getHash (idOrAddr: number|string): Promise<string>

    checkCodeHash (address: string, codeHash?: string): Promise<void>

    upload (data: Uint8Array): Promise<Template>

    instantiate (template, label, msg, funds?)

    getCodeId (address: string): Promise<string>

    getLabel (address: string): Promise<string>

    query <T, U> (instance: Instance, msg: T): Promise<U>

    // @ts-ignore
    execute <T> (instance: Instance, msg: T, memo: any, amount: any, fee: any): Promise<ExecuteResult>

    encrypt (codeHash, msg): Promise<unknown>

    signTx (msgs, gas, memo): Promise<unknown>

    private initialWait: number

    config: any

    private rateLimited <T> (fn: ()=>Promise<T>): Promise<T>
  }

  export class LegacyScrt extends ScrtChain {

    static Agent: typeof LegacyScrtAgent

    Agent: typeof LegacyScrt.Agent

  }

  export class LegacyScrtBundle extends ScrtBundle {

    agent: LegacyScrtAgent

    static bundleCounter: number

    protected get nonce (): Promise<ScrtNonce>

    protected encrypt (codeHash, msg): Promise<unknown>

    submit (memo?: string): Promise<ScrtBundleResult[]>

    /** Format the messages for API v1 like secretjs and encrypt them. */
    buildForSubmit (): Promise<unknown>

    private collectSubmitResults (msgs, txResult): unknown

    private handleSubmitError (err): void

    /** Format the messages for API v1beta1 like secretcli
      * and generate a multisig-ready unsigned transaction bundle;
      * don't execute it, but save it in `receipts/$CHAIN_ID/transactions`
      * and output a signing command for it to the console. */
    save (name: string): Promise<void>

    private buildForSave (msgs): Promise<unknown>

    private finalizeForSave (messages, memo): unknown

  }

  export function getNonce (url, address): Promise<ScrtNonce>

  export * from '@fadroma/client-scrt'

}
