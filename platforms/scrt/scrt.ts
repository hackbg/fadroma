/*
  Fadroma Platform Package for Secret Network
  Copyright (C) 2022 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/

import type {
  Address, CodeHash, CodeId, TxHash, Uint128,
  AgentClass, AgentOpts,
  BundleClass,
  ChainClass, ChainOpts, ChainId,
  DeployArgs, Label, Message,
  ExecOpts, ICoin, IFee,
} from '@fadroma/client'
import { Agent, Bundle, Chain, Client, Contract, Fee } from '@fadroma/client'

import { base64, randomBytes, bip39, bip39EN } from '@hackbg/formati'
import structuredClone from '@ungap/structured-clone'

import { ScrtConfig, ScrtGrpcConfig } from './scrt-config'
import { ScrtError, ScrtConsole } from './scrt-events'

/** Base class for both implementations of Secret Network API (gRPC and Amino).
  * Represents the Secret Network in general. */
export abstract class Scrt extends Chain {
  static Config                   = ScrtConfig
  static defaultMainnetChainId    = this.Config.defaultMainnetChainId
  static defaultTestnetChainId    = this.Config.defaultTestnetChainId
  static Agent:           AgentClass<ScrtAgent> // set below
  static isSecretNetwork: boolean = true
  static defaultDenom:    string  = 'uscrt'
  static gas (amount: Uint128|number) { return new Fee(amount, this.defaultDenom) }
  static defaultFees = {
    upload: this.gas(1000000),
    init:   this.gas(1000000),
    exec:   this.gas(1000000),
    send:   this.gas(1000000),
  }

  log = new ScrtConsole('Scrt')
  Agent: AgentClass<ScrtAgent> = Scrt.Agent
  isSecretNetwork: boolean = Scrt.isSecretNetwork
  defaultDenom:    string  = Scrt.defaultDenom
}

/** Agent configuration options that are common betweeen
  * gRPC and Amino implementations of Secret Network. */
export interface ScrtAgentOpts extends AgentOpts {
  keyPair?: unknown
}

/** Base class for both implementations of Secret Network API (gRPC and Amino).
  * Represents a connection to the Secret Network authenticated as a specific address. */
export abstract class ScrtAgent extends Agent {
  log = new ScrtConsole('ScrtAgent')
  static Bundle: BundleClass<ScrtBundle>
  Bundle: BundleClass<ScrtBundle> =
    ((this.constructor as AgentClass<Agent>).Bundle) as BundleClass<ScrtBundle>
  fees = Scrt.defaultFees
  abstract getNonce (): Promise<{ accountNumber: number, sequence: number }>
  abstract encrypt (codeHash: CodeHash, msg: Message): Promise<string>
}

/** Base class for transaction-bundling Agent for both Secret Network implementations. */
export abstract class ScrtBundle extends Bundle {
  static bundleCounter: number = 0
  declare agent: ScrtAgent
  /** Format the messages for API v1beta1 like secretcli and generate a multisig-ready
    * unsigned transaction bundle; don't execute it, but save it in
    * `receipts/$CHAIN_ID/transactions` and output a signing command for it to the console. */
  async save (name?: string) {
    // Number of bundle, just for identification in console
    const N = ++ScrtBundle.bundleCounter
    name ??= name || `TX.${N}.${+new Date()}`
    // Get signer's account number and sequence via the canonical API
    const { accountNumber, sequence } = await this.agent.getNonce()//this.chain.url, this.agent.address)
    // Print the body of the bundle
    log.bundleMessages(this.msgs, N)
    // The base Bundle class stores messages as (immediately resolved) promises
    const messages = await Promise.all(this.msgs.map(({init, exec})=>{
      // Encrypt init message
      if (init) return this.encryptInit(init)
      // Encrypt exec/handle message
      if (exec) return this.encryptInit(init)
      // Anything in the messages array that does not have init or exec key is ignored
    }))
    // Print the body of the bundle
    log.bundleMessagesEncrypted(messages, N)
    // Compose the plaintext
    const unsigned = this.composeUnsignedTx(messages)
    // Output signing instructions to the console
    log.bundleSigningCommand(
      String(Math.floor(+ new Date()/1000)),
      this.agent.address!, this.agent.assertChain().id,
      accountNumber, sequence, unsigned
    )
    return { N, name, accountNumber, sequence, unsignedTxBody: JSON.stringify(unsigned) }
  }
  private async encryptInit (init: any): Promise<any> {
    const encrypted = await this.agent.encrypt(init.codeHash, init.msg)
    return {
      "@type":            "/secret.compute.v1beta1.MsgInstantiateContract",
      callback_code_hash: '',
      callback_sig:       null,
      sender:             init.sender,
      code_id:     String(init.codeId),
      init_funds:         init.funds,
      label:              init.label,
      init_msg:           encrypted,
    }
  }
  private async encryptExec (exec: any): Promise<any> {
    const encrypted = await this.agent.encrypt(exec.codeHash, exec.msg)
    return {
      "@type":            '/secret.compute.v1beta1.MsgExecuteContract',
      callback_code_hash: '',
      callback_sig:       null,
      sender:             exec.sender,
      contract:           exec.contract,
      sent_funds:         exec.funds,
      msg:                encrypted,
    }
  }
  private composeUnsignedTx (encryptedMessages: any[]): any {
    const fee = Scrt.gas(10000000)
    const gas = fee.gas
    const payer = ""
    const granter = ""
    const auth_info = { signer_infos: [], fee: { ...fee, gas, payer, granter }, }
    const signatures: any[] = []
    const body = {
      messages:                       encryptedMessages,
      memo:                           name,
      timeout_height:                 "0",
      extension_options:              [],
      non_critical_extension_options: []
    }
    return { auth_info, signatures, body }
  }

}

Scrt.Agent        = ScrtAgent  as unknown as AgentClass<ScrtAgent>
Scrt.Agent.Bundle = ScrtBundle as unknown as BundleClass<ScrtBundle>

export interface ScrtBundleClass <B extends ScrtBundle> {
  new (agent: ScrtAgent): B
}

/** Data used for creating a signature as per the SNIP-24 spec:
  * https://github.com/SecretFoundation/SNIPs/blob/master/SNIP-24.md#permit-content---stdsigndoc
  * This type is case sensitive! */
export interface SignDoc {
  readonly chain_id:       string;
  /** Always 0. */
  readonly account_number: string;
  /** Always 0. */
  readonly sequence:       string;
  /** Always 0 uscrt + 1 gas */
  readonly fee:            IFee;
  /** Always 1 message of type query_permit */
  readonly msgs:           readonly AminoMsg[];
  /** Always empty. */
  readonly memo:           string;
}

export function createSignDoc <T> (
  chain_id:   ChainId,
  permit_msg: T
) {
  return {
    chain_id,
    account_number: "0", // Must be 0
    sequence: "0", // Must be 0
    fee: {
      amount: [{ denom: "uscrt", amount: "0" }], // Must be 0 uscrt
      gas: "1", // Must be 1
    },
    msgs: [
      {
        type: "query_permit", // Must be "query_permit"
        value: permit_msg,
      },
    ],
    memo: "", // Must be empty
  }
}

export interface Signer {
  chain_id: ChainId
  address:  Address
  sign <T> (permit_msg: PermitAminoMsg<T>): Promise<Permit<T>>
}

export class KeplrSigner implements Signer {

  constructor (
    /** The id of the chain which permits will be signed for. */
    readonly chain_id: ChainId,
    /** The address which will do the signing and
      * which will be the address used by the contracts. */
    readonly address:  Address,
    /** Must be a pre-configured instance. */
    readonly keplr:    KeplrSigningHandle<any>
  ) {}

  async sign <T> (permit_msg: PermitAminoMsg<T>): Promise<Permit<T>> {

    const { signature } = await this.keplr.signAmino(
      this.chain_id,
      this.address,
      createSignDoc(this.chain_id, permit_msg),
      {
        preferNoSetFee: true,  // Fee must be 0, so hide it from the user
        preferNoSetMemo: true, // Memo must be empty, so hide it from the user
      }
    )

    return {
      params: {
        chain_id:       this.chain_id,
        allowed_tokens: permit_msg.allowed_tokens,
        permit_name:    permit_msg.permit_name,
        permissions:    permit_msg.permissions
      },
      signature
    }

  }

}

export interface KeplrSigningHandle <T> {
  signAmino (
    chain_id: ChainId,
    address:  Address,
    signDoc:  SignDoc,
    options: { preferNoSetFee: boolean, preferNoSetMemo: boolean }
  ): Promise<Permit<T>>
}

export interface Permit<T> {
  params: {
    permit_name:    string,
    allowed_tokens: Address[]
    chain_id:       string,
    permissions:    T[]
  },
  signature: Signature
}

// This type is case sensitive!
export interface Signature {
  readonly pub_key: Pubkey
  readonly signature: string
}

export interface Pubkey {
  /** Must be: `tendermint/PubKeySecp256k1` */
  readonly type: string
  readonly value: any
}

export interface AminoMsg {
  readonly type: string;
  readonly value: any;
}

/** Used as the `value` field of the {@link AminoMsg} type. */
export interface PermitAminoMsg<T> {
  permit_name:    string,
  allowed_tokens: Address[],
  permissions:    T[],
}

export type ViewingKey = string

export class ViewingKeyClient extends Client {

  async create (entropy = randomBytes(32).toString("hex")) {
    const msg    = { create_viewing_key: { entropy, padding: null } }
    let { data } = await this.execute(msg) as { data: Uint8Array|Uint8Array[] }
    if (data instanceof Uint8Array) data = [data]
    return data[0]
  }

  async set (key: unknown) {
    return this.execute({ set_viewing_key: { key } })
  }

}

const log = new ScrtConsole()

/** Allow Scrt clients to be implemented with just `@fadroma/scrt` */
export * from '@fadroma/client'

/** Expose configuration objects. */
export { ScrtConfig, ScrtGrpcConfig }

/** Expose console and error objects */

export { ScrtError, ScrtConsole }
