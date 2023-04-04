export class MultiContractSlot<C extends Client> extends Contract<C> {

  log = new Console('Fadroma.Contract')
  /** Prefix of the instance.
    * Identifies which Deployment the instance belongs to, if any.
    * Prepended to contract label with a `/`: `PREFIX/NAME...` */
  prefix?: Name = undefined
  /** A mapping of Names (unprefixed Labels) to init configurations for the respective contracts. */
  inits?:  IntoRecord<Name, AnyContract> = undefined
  /** A filter predicate for recognizing deployed contracts. */
  match?:  MatchPredicate = meta => Object.keys(this.inits??{}).includes(meta.name!)

  constructor (
    options: Partial<AnyContract> = {},
    /** The group of contracts that contract belongs to. */
    public context?: Deployment,
    /** The agent that will upload and instantiate this contract. */
    public agent:    Agent     |undefined = context?.agent
  ) {
    super(options)
    this.define(options as object)
    hide(this, ['log'])
  }

  /** One-shot deployment task. */
  get deployed (): Promise<Record<Name, C>> {
    const clients: Record<Name, C> = {}
    if (!this.inits) throw new Error.NoInitMessage()
    return into(this.inits!).then(async inits=>{
      // Collect separately the contracts that already exist
      for (const [name, args] of Object.entries(inits)) {
        const client = (this.client ?? Client).fromContract(this)
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
  deploy (inputs: IntoRecord<Name, AnyContract> = this.inits ?? {}): Promise<Record<Name, C>> {
    const count = `${Object.keys(inputs).length} contract(s)`
    const name = undefined
        ?? (this.codeId && `deploy ${count} of code id ${this.codeId}`)
        ?? (this.crate  && `deploy ${count} of crate ${this.crate}`)
        ?? `deploy ${count}`
    return defineTask(name, async (): Promise<Record<Name, C>> => {
      // need an agent to proceed
      const agent = assertAgent(this)
      // get the inits if passed lazily
      const inits = await intoRecord(inputs, this.context)
      // if deploying 0 contracts we're already done
      if (Object.keys(inits).length === 0) return Promise.resolve({})
      // upload then instantiate (upload may be a no-op if cached)
      const template = await this.uploaded
      // at this point we should have a code id
      if (!this.codeId) throw new Error.NoInitCodeId(name)
      // prepare each contract
      for (const [name, contract] of Object.entries(inits) as [Name, AnyContract][]) {
        // if operating in a Deployment, add prefix to each name (should be passed unprefixed)
        contract.label   = writeLabel({ name, prefix: this.context?.name })
        // resolve all init messages
        contract.initMsg = await into(contract.initMsg)
      }
      try {
        // run a bundled transaction creating each contract
        const responses = await agent.instantiateMany(inits)
        // get a Contract object representing each
        const contracts = Object.values(responses).map(response=>
          new Contract(new Contract<C>(this)).define(response))
        // get a Client from each Contract
        const clients   = Object.fromEntries(contracts.map(contract=>
          [contract.name, (contract.client ?? Client).fromContract(contract)]))
        // if operating in a Deployment, save each contract to the receipt
        if (this.context) Object.keys(inits).forEach(name=>this.context!.contract.add(name, responses[name]))
        // return the battle-ready clients
        return clients
      } catch (e) {
        this.log.deployManyFailed(this as Instantiable, Object.values(inits), e as Error)
        throw e
      }
    }, this)
  }

  /** Get all contracts that match the specified predicate. */
  get (match: MatchPredicate|undefined = this.match): Promise<Record<Name, C>> {
    if (!match) throw new Error.NoPredicate()
    const info = match.name
      ? `get all contracts matching predicate: ${match.name}`
      : `get all contracts matching specified predicate`
    return defineTask(info, () => {
      if (!this.context) throw new Error.NoDeployment()
      const clients: Record<Name, C> = {}
      for (const info of Object.values(this.context!.state)) {
        if (!match(info as Partial<Contract<C>>)) continue
        clients[info.name!] = (this.client ?? Client).fromContract(this)
      }
      return Promise.resolve(clients)
    }, this)
  }

}

