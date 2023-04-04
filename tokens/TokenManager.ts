import Snip20 from './Snip20'
import type { Snip20InitConfig } from './Snip20'
import { TokenPair } from './Token'
import type { Token } from './Token'

import { Console, Contract, writeLabel } from '@fadroma/agent'
import type { Address, Deployment, AnyContract, Template } from '@fadroma/agent'

import { CommandContext } from '@hackbg/cmds'
import type { Task } from '@hackbg/task'
import type { Many } from '@hackbg/many'

export type TokenSymbol = string

export type TokenContract = Contract<Snip20>

export type TokenTemplate = Template<Snip20>

export interface TokenOptions {
  template?: TokenContract
  name:      string
  decimals:  number
  admin:     Address,
  config?:   Snip20InitConfig
}

/** Keeps track of real and mock tokens using during stackable deployment procedures. */
export default class TokenManager extends CommandContext {

  constructor (
    /** Function that returns the active deployment. */
    public context: Deployment,
    /** Template for deploying new tokens. */
    public template: TokenTemplate = context.template({ client: Snip20 }),
    /** Default token config. */
    public defaultConfig: Snip20InitConfig = {
      public_total_supply: true,
      enable_mint: true
    }
  ) {

    super('tokens', 'token manager')

    for (const hide of [
      'log', 'name', 'description', 'timestamp',
      'commandTree', 'currentCommand',
      'args', 'task', 'before'
    ]) Object.defineProperty(this, hide, { enumerable: false, writable: true })

    /** Command step: Deploy a single Snip20 token.
      * Exposed below as the "deploy token" command.
      * Invocation is "pnpm run deploy token  */
    this.command(
      'deploy',
      'deploy one snip20 token; args: $name $symbol $decimals [$admin] [$crate]"',
      async function deployCLI (
        this:      TokenManager,
        name:      string|undefined  = this.args[0],
        symbol:    string|undefined  = this.args[1],
        decimals:  number|undefined  = Number(this.args[2]??0),
        admin:     Address|undefined = this.args[3]??this.context.agent?.address,
        template:  any               = this.args[4]??'amm-snip20'
      ) {
        if (!name)     throw new Error('Specify name')
        if (!symbol)   throw new Error('Specify symbol')
        if (!decimals) throw new Error('Specify decimals')
        const args   = this.args.slice(5)
        const config = structuredClone(this.defaultConfig)
        if (args.includes('--no-public-total-supply')) delete config.public_total_supply
        if (args.includes('--no-mint'))     delete config.enable_mint
        if (args.includes('--can-burn'))    config.enable_burn    = true
        if (args.includes('--can-deposit')) config.enable_deposit = true
        if (args.includes('--can-redeem'))  config.enable_redeem  = true
        if (typeof template === 'string') template = this.context.contract({ crate: template })
        return await this.define(symbol, { name, decimals, admin, template })
      })
  }

  /* Logger. */
  log = new Console('Fadroma Token Manager')

  /** Collection of known tokens in descriptor format, keyed by symbol. */
  tokens: Record<TokenSymbol, TokenContract> = {}

  get config () { return this.context.config }

  /** See if this symbol is registered. */
  has (symbol: TokenSymbol): boolean {
    return Object.keys(this.tokens).includes(symbol)
  }

  /** Register a token contract. */
  add (symbol: TokenSymbol, contract: TokenContract): TokenContract
  add (symbol: TokenSymbol, contract: Partial<TokenContract>): TokenContract
  add (symbol: TokenSymbol, contract: unknown): TokenContract {
    const token = (contract instanceof Contract)
      ? contract
      : this.context.contract(contract as Partial<TokenContract>)
    token.name ??= symbol
    this.tokens[symbol] = token
    return token
  }

  /** Return token or throw */
  get (symbol: TokenSymbol): TokenContract {
    if (this.has(symbol)) return this.tokens[symbol]
    if (this.context.devMode) return this.define(symbol)
    throw new Error(`No token "${symbol}"`)
  }

  /** Get a TokenPair object from a string like "SYMBOL1-SYMBOL2"
    * where both symbols are registered */
  async pair (name: string): Promise<TokenPair> {
    const [token_0_symbol, token_1_symbol] =
      name.split('-')
    const [token_0, token_1]: [TokenContract, TokenContract] =
      await Promise.all([this.get(token_0_symbol), this.get(token_1_symbol)])
    const [token_0_client, token_1_client] =
      await Promise.all([token_0(), token_1()])
    return new TokenPair(token_0_client.asDescriptor, token_1_client.asDescriptor)
  }

  /** Define a Snip20 token and add it to the registry. */
  define (symbol: TokenSymbol, options?: Partial<TokenOptions>): TokenContract {

    // If this token is not already known, define it it
    if (!this.has(symbol)) {

      // Need a name to proceed. Defaults to symbol
      const name = options?.name ?? symbol
      if (!name) throw new Error('no name')

      // Define and register a contract.
      const instance = this.template.instance({
        workspace: this.config?.build?.project,
        name,
        prefix: this.context.name,
        label: writeLabel({ prefix: this.context.name, name }),
        client: Snip20,
        initMsg: Snip20.init(
          name,
          symbol,
          options?.decimals ?? 8,
          options?.admin    ?? this.context.agent?.address!,
          options?.config
        ),
      }) as TokenContract

      this.add(symbol, this.context.addContract(name, instance))
    }

    return this.get(symbol)

  }

  /** Define multiple Snip20 tokens, keyed by symbol. */
  defineMany (inputs: Record<TokenSymbol, Partial<TokenOptions>>):
    Task<TokenTemplate, Many<Task<Contract<Snip20>, Snip20>>>
  {

    const outputs: Record<TokenSymbol, TokenContract> = {}

    for (const [symbol, options] of Object.entries(inputs)) {
      outputs[symbol] = this.define(symbol, options)
    }

    return this.template.instances(outputs)

    /*
    // Find out which tokens to deploy and which already exist
    // (at the point of time where the task is defined)
    const existing: Record<TokenSymbol, TokenContract> = {}
    const deployed: Record<TokenSymbol, Contract> = {}
    const bundle = this.context.agent!.bundle()
    // Collect existing and undeployed tokens in separate bins
    for (let [symbol, options] of Object.entries(definitions)) {
      if (this.has(symbol)) {
        existing[symbol] = this.tokens[symbol]
      } else {
        deployed[symbol] = [
          options.name ?? symbol,
          Snip20.init(
            options.name ?? symbol,
            symbol,
            options.decimals ?? 8,
            options.admin ?? this.context.agent!.address!,
            options.config
          )
        ]
      }
    }
    const names = Object.keys(definitions)
    // Return a Task that, when evaluated, will return all the specified tokens
    return this.context.task(`deploy ${names.length} tokens: ${names.join(', ')}`, async () => {
      const results: Record<string, Snip20> = {}
      // Add clients to existing tokens
      for (const [symbol, contract] of Object.entries(existing)) {
        results[symbol] = await contract
      }
      const entries   = Object.entries(deployed)
      const symbols   = entries.map(x=>x[0])
      const inits     = entries.map(x=>x[1])
      const template  = this.template as Partial<Contracts<Snip20>>
      const contracts = this.context.defineContracts<Snip20>(template).define({ inits: deployed })
      const clients   = await contracts
      for (const i in entries) {
        const [symbol] = entries[i]
        const client = clients[i]
        results[symbol] = client as Snip20
        this.add(symbol, contracts.contract(client as Partial<Contract>))
      }
      return results
    })*/
  }
}
