import { into } from './core-fields'
import { ClientError } from './core-events'
import { assertAddress } from './core-connect'
import { ContractTemplate, toUploadReceipt } from './core-contract-template'
import { assertCodeHash } from './core-code'
import { writeLabel } from './core-labels'
import type { Task } from '@hackbg/komandi'
import type { Into } from './core-fields'
import type { CodeId } from './core-code'
import type { Name, Label, StructuredLabel } from './core-labels'
import type {
  Address, TxHash, Agent, Chain, ChainId, Message, ContractLink, Client, ClientClass
} from './core-connect'

export function intoInstance <C extends Client> (
  x: Partial<ContractInstance<C>>
): ContractInstance<C> {
  if (x instanceof ContractInstance) return x
  return new ContractInstance(x)
}

/** Minimal parameters required to deploy a contract. */
export interface Deployable { chainId: ChainId; codeId: CodeId }

/** Represents a smart contract's lifecycle from source to individual instance. */
export class ContractInstance<C extends Client>
  extends    ContractTemplate<C>
  implements StructuredLabel
{
  /** Address of agent that performed the init tx. */
  initBy?:  Address       = undefined
  /** Address of agent that performed the init tx. */
  initMsg?: Into<Message> = undefined
  /** TXID of transaction that performed the init. */
  initTx?:  TxHash        = undefined
  /** Address of this contract instance. Unique per chain. */
  address?: Address       = undefined
  /** Full label of the instance. Unique for a given Chain. */
  label?:   Label         = undefined
  /** Prefix of the instance.
    * Identifies which Deployment the instance belongs to, if any.
    * Prepended to contract label with a `/`: `PREFIX/NAME...` */
  prefix?:  Name          = undefined
  /** Proper name of the instance.
    * If the instance is not part of a Deployment, this is equal to the label.
    * If the instance is part of a Deployment, this is used as storage key.
    * You are encouraged to store application-specific versioning info in this field. */
  name?:    Name          = undefined
  /** Deduplication suffix.
    * Appended to the contract label with a `+`: `...NAME+SUFFIX`.
    * This field has sometimes been used to redeploy an new instance
    * within the same Deployment, taking the place of the old one.
    * TODO: implement this field's semantics: last result of **alphanumeric** sort of suffixes
    *       is "the real one" (see https://stackoverflow.com/a/54427214. */
  suffix?:  Name          = undefined

  constructor (options: Partial<ContractInstance<C>> = {}) {
    super(options)
    this.define(options as object)
  }

  get [Symbol.toStringTag]() {
    return `${this.name??'-'} ${this.address??'-'} ${this.crate??'-'} @ ${this.revision??'HEAD'}`
  }

  /** Get link to this contract in Fadroma ICC format. */
  get asLink (): ContractLink {
    return { address: assertAddress(this), code_hash: assertCodeHash(this) }
  }

  /** One-shot deployment task. */
  get deployed (): Promise<C> {
    const client = this.getClientOrNull()
    if (client) {
      this.log.foundDeployedContract(client.address!, this.name!)
      return Promise.resolve(client as C)
    }
    const deploying = this.deploy()
    Object.defineProperty(this, 'deployed', { get () { return deploying } })
    return deploying
  }

  /** Deploy the contract, or retrieve it if it's already deployed.
    * @returns promise of instance of `this.client`  */
  deploy (initMsg: Into<Message>|undefined = this.initMsg): Task<this, C> {
    return this.task(`deploy ${this.name ?? 'contract'}`, async () => {
      if (!this.agent) throw new ClientError.NoAgent(this.name)
      if (!this.name) throw new ClientError.NoName(this.name)
      this.label = writeLabel(this)
      if (!this.label) throw new ClientError.NoInitLabel(this.name)
      if (!this.initMsg) throw new ClientError.NoInitMessage(this.name)
      await this.uploaded
      if (!this.codeId) throw new ClientError.NoInitCodeId(this.name)
      this.initMsg = await into(initMsg) as Message
      this.log.beforeDeploy(this, this.label!)
      const contract = await this.agent!.instantiate(this)
      this.define(contract as Partial<this>)
      this.log.afterDeploy(this as Partial<ContractInstance<C>>)
      if (this.context) this.context.contract.add(this.name!, contract)
      return this.getClient()
    })
  }

  /** Async wrapper around getClientSync.
    * @returns a Client instance pointing to this contract
    * @throws if the contract address could not be determined */
  getClient (
    $Client: ClientClass<C>|undefined = this.client
  ): Promise<C> {
    return Promise.resolve(this.getClientSync($Client))
  }

  /** @returns a Client instance pointing to this contract
    * @throws if the contract address could not be determined */
  getClientSync (
    $Client: ClientClass<C>|undefined = this.client
  ): C {
    const client = this.getClientOrNull($Client)
    if (!client) throw new ClientError.NotFound($Client.name, this.name)
    return client
  }

  /** @returns a Client instance pointing to this contract, or null if
    * the contract address could not be determined */
  getClientOrNull (
    $Client: ClientClass<C>|undefined = this.client,
    agent:   Agent|undefined          = this.agent
  ): C|null {
    if (!this.address) return null
    return new $Client(agent, this.address, this.codeHash, this) as C
  }

}
