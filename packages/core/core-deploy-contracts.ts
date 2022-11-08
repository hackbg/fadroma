import { hide, into, intoRecord } from './core-fields'
import type { IntoRecord } from './core-fields'
import { ClientError, ClientConsole } from './core-events'
import { assertAgent } from './core-connect'
import type { Agent, Client } from './core-connect'
import { ContractTemplate } from './core-upload'
import type { ContractSource } from './core-build'
import { intoSource } from './core-build'
import type { Name } from './core-labels'
import { writeLabel } from './core-labels'
import type { Deployment } from './core-deployment'

export interface DeploymentMultiContractAPI {
  set (receipts: Record<string, any>): this
  build (contracts: (string|ContractSource)[]): Promise<ContractSource[]>
  upload (contracts: ContractSource[]): Promise<ContractTemplate<Client>[]>
}

export function deploymentMultiContractAPI <D extends Deployment> (self: D) {

  let fn = function contracts <C extends Client> (
    options: Partial<MultiContractSlot<C>>
  ): MultiContractSlot<C> {
    return new MultiContractSlot<C>({...options}).attach(this)
  }

  fn = fn.bind(self)

  const methods: DeploymentMultiContractAPI = {

    /** Chainable. Add multiple entries to the deployment, replacing existing receipts. */
    set (receipts) {
      for (const [name, receipt] of Object.entries(receipts)) this.state[name] = receipt
      this.save()
      return this
    },

    /** Build multiple contracts. */
    build: buildMany,

    /** Upload multiple contracts to the chain.
      * @returns the same contracts, but with `chainId`, `codeId` and `codeHash` populated. */
    upload: uploadMany

  }

  for (const key in methods) fn[key] = methods[key].bind(self)

  return fn

  async function buildMany (
    contracts: (string|ContractSource)[]
  ): Promise<ContractSource[]> {
    return this.task(`build ${contracts.length} contracts`, async () => {
      if (!this.builder) throw new ClientError.NoBuilder()
      if (contracts.length === 0) return Promise.resolve([])
      contracts = contracts.map(contract=>{
        if (typeof contract === 'string') {
          return this.contract({ crate: contract }) as ContractSource
        } else {
          return contract
        }
      })
      const count = (contracts.length > 1)
        ? `${contracts.length} contract: `
        : `${contracts.length} contracts:`
      const sources = (contracts as ContractTemplate<Client>[])
        .map(contract=>`${contract.crate}@${contract.revision}`)
        .join(', ')
      return this.task(`build ${count} ${sources}`, () => {
        if (!this.builder) throw new ClientError.NoBuilder()
        return this.builder.buildMany(contracts as ContractSource[])
      })
    })
  }

  async function uploadMany (
    contracts: ContractSource[]
  ): Promise<ContractTemplate<Client>[]> {
    return this.task(`upload ${contracts.length} contracts`, async () => {
      if (!this.uploader) throw new ClientError.NoUploader()
      if (contracts.length === 0) return Promise.resolve([])
      contracts = contracts
        .map(contract=>(typeof contract === 'string')
          ?this.contract({ crate: contract }):contract)
        .map(contract=>intoSource(contract))
      const count = (contracts.length > 1)
        ? `${contracts.length} contract: `
        : `${contracts.length} contracts:`
      return this.task(`upload ${count} artifacts`, () => {
        if (!this.uploader) throw new ClientError.NoUploader()
        return this.uploader.uploadMany(contracts)
      })
    })
  }

}


export type MatchPredicate = (meta: Partial<ContractInstance>) => boolean|undefined

export class MultiContractSlot<C extends Client> extends ContractTemplate {

  log = new ClientConsole('Fadroma.Contract')
  /** Prefix of the instance.
    * Identifies which Deployment the instance belongs to, if any.
    * Prepended to contract label with a `/`: `PREFIX/NAME...` */
  prefix?: Name = undefined
  /** A mapping of Names (unprefixed Labels) to init configurations for the respective contracts. */
  inits?:  IntoRecord<Name, ContractInstance> = undefined
  /** A filter predicate for recognizing deployed contracts. */
  match?:  MatchPredicate = meta => Object.keys(this.inits??{}).includes(meta.name!)

  constructor (
    options: Partial<ContractInstance> = {},
    /** The group of contracts that contract belongs to. */
    public context?: Deployment,
    /** The agent that will upload and instantiate this contract. */
    public agent:    Agent     |undefined = context?.agent
  ) {
    super(options)
    this.define(options as object)
    hide(this, ['log'])
  }

  attach (context: Deployment): this {
    return attachToDeployment<C, this>(this, context)
  }

  /** One-shot deployment task. */
  get deployed (): Promise<Record<Name, C>> {
    const clients: Record<Name, C> = {}
    if (!this.inits) throw new ClientError.NoInitMessage()
    return into(this.inits!).then(async inits=>{
      // Collect separately the contracts that already exist
      for (const [name, args] of Object.entries(inits)) {
        const contract = new ContractSlot(this as ContractTemplate).define({ name })
        const client = contract.getClientOrNull()
        if (client) {
          this.log.foundDeployedContract(client.address!, name)
          clients[name] = client as C
          delete inits[name]
        }
      }
      // If there are any left to deploy, deploy em
      if (Object.keys(inits).length > 0) {
        Object.assign(clients, await this.deploy(inits))
      }
      return clients
    })
  }

  /** Deploy multiple instances of the same template. */
  deploy (inputs: IntoRecord<Name, ContractInstance> = this.inits ?? {}): Promise<Record<Name, C>> {
    const count = `${Object.keys(inputs).length} instance(s)`
    const name = undefined
        ?? (this.codeId && `deploy ${count} of code id ${this.codeId}`)
        ?? (this.crate  && `deploy ${count} of crate ${this.crate}`)
        ?? `deploy ${count}`
    return this.task(name, async (): Promise<Record<Name, C>> => {
      // need an agent to proceed
      const agent = assertAgent(this)
      // get the inits if passed lazily
      const inits = await intoRecord(inputs, this.context)
      // if deploying 0 contracts we're already done
      if (Object.keys(inits).length === 0) return Promise.resolve({})
      // upload then instantiate (upload may be a no-op if cached)
      const template = await this.uploaded
      // at this point we should have a code id
      if (!this.codeId) throw new ClientError.NoInitCodeId(name)
      // prepare each instance
      for (const [name, instance] of Object.entries(inits)) {
        // if operating in a Deployment, add prefix to each name (should be passed unprefixed)
        instance.label   = writeLabel({ name, prefix: this.context?.name })
        // resolve all init messages
        instance.initMsg = await into(instance.initMsg)
      }
      try {
        // run a bundled transaction creating each instance
        const responses = await agent.instantiateMany(inits)
        // get a Contract object representing each
        const contracts = Object.values(responses).map(response=>
          new ContractSlot(new ContractTemplate(this)).define(response))
        // get a Client from each Contract
        const clients   = Object.fromEntries(contracts.map(contract=>
          [contract.name, contract.getClientSync()]))
        // if operating in a Deployment, save each instance to the receipt
        if (this.context) Object.keys(inits).forEach(name=>this.context!.add(name, responses[name]))
        // return the battle-ready clients
        return clients
      } catch (e) {
        this.log.deployManyFailed(this, Object.values(inits), e as Error)
        throw e
      }
    })
  }

  /** Get all contracts that match the specified predicate. */
  get (match: MatchPredicate|undefined = this.match): Promise<Record<Name, C>> {
    if (!match) throw new ClientError.NoPredicate()
    const info = match.name
      ? `get all contracts matching predicate: ${match.name}`
      : `get all contracts matching specified predicate`
    return this.task(info, () => {
      if (!this.context) throw new ClientError.NoDeployment()
      const clients: Record<Name, C> = {}
      for (const info of Object.values(this.context!.state)) {
        if (!match(info as Partial<ContractInstance>)) continue
        clients[info.name!] = new ContractSlot(new ContractTemplate(this))
          .define(info).getClientSync() as C
      }
      return Promise.resolve(clients)
    })
  }

}
