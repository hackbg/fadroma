import {
  Address,
  Agent,
  Client,
  ClientConsole,
  CodeHash,
  Coin,
  Contract,
  Contracts,
  ContractTemplate,
  ContractInstance,
  Deployment,
  ICoin,
  Label,
  Uint128,
} from '@fadroma/client'
import { Permit, ViewingKeyClient } from '@fadroma/scrt'
import { CustomError, bold, colors } from '@hackbg/konzola'
import { Task, CommandContext } from '@hackbg/komandi'
import { Snip20 } from './tokens-snip20'
import type { Snip20InitConfig } from './tokens-snip20'
import type { Token } from './tokens-desc'
import { TokenPair } from './tokens-desc'

const log = new ClientConsole('Fadroma.TokenManager')

export type TokenSymbol = string

export interface TokenOptions {
  template?: Partial<Contract<Snip20>>
  name:      string
  decimals:  number
  admin:     Address,
  config?:   Snip20InitConfig
}

export type Tokens = Record<string, Snip20|Token>

/** Keeps track of real and mock tokens using during stackable deployment procedures. */
export class TokenManager extends CommandContext {
  /* Logger. */
  log = log
  /** Collection of known tokens in descriptor format, keyed by symbol. */
  tokens: Record<TokenSymbol, Contract<Snip20>> = {}

  constructor (
    /** Function that returns the active deployment. */
    public context:       Deployment,
    /** Template for deploying new tokens. */
    public template:      ContractTemplate = new ContractTemplate(),
    /** Default token config. */
    public defaultConfig: Snip20InitConfig = {
      public_total_supply: true,
      enable_mint:         true
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

  /** See if this symbol is registered. */
  has (symbol: TokenSymbol): boolean {
    return Object.keys(this.tokens).includes(symbol)
  }
  /** Return token or throw */
  get (symbol: TokenSymbol): Contract<Snip20> {
    if (!this.has(symbol)) throw new Error(`No token "${symbol}"`)
    return this.tokens[symbol]
  }
  add (symbol: TokenSymbol, token: Contract<Snip20>): Contract<Snip20> {
    token.name ??= symbol
    return this.tokens[symbol] = token
  }
  /** Define a Snip20 token, get/deploy it, and add it to the registry. */
  define (symbol: TokenSymbol, options?: Partial<TokenOptions>): Contract<Snip20> {
    // If this token is already known, return it
    if (this.has(symbol)) return this.get(symbol)
    // Need a name to proceed. Defaults to symbol
    const name = options?.name ?? symbol
    if (!name) throw new Error('no name')
    // Define and register a contract; await it to deploy.
    return this.add(symbol, this.template.contract({
      name,
      client:  Snip20,
      initMsg: Snip20.init(
        name,
        symbol,
        options?.decimals ?? 8,
        options?.admin    ?? this.context.agent!.address!,
        options?.config
      ),
      ...options
    }))
  }
  /** Define multiple Snip20 tokens, keyed by symbol. */
  defineMany (inputs: Record<TokenSymbol, Partial<TokenOptions>>):
    Record<TokenSymbol, Contract<Snip20>>
  {
    const outputs: Record<TokenSymbol, Contract<Snip20>> = {}
    for (const [symbol, options] of Object.entries(inputs)) {
      outputs[symbol] = this.define(symbol, options)
    }
    return this.template.contracts(outputs)
    /*
    // Find out which tokens to deploy and which already exist
    // (at the point of time where the task is defined)
    const existing: Record<TokenSymbol, Contract<Snip20>> = {}
    const deployed: Record<TokenSymbol, ContractInstance> = {}
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
      const contracts = this.context.contracts<Snip20>(template).provide({ inits: deployed })
      const clients   = await contracts
      for (const i in entries) {
        const [symbol] = entries[i]
        const client = clients[i]
        results[symbol] = client as Snip20
        this.add(symbol, contracts.contract(client as Partial<ContractInstance>))
      }
      console.log({tokens: results})
      return results
    })*/
  }
  deploy = this.command('deploy', 'deploy a token', async (
    name:      string|undefined  = this.args[0],
    symbol:    string|undefined  = this.args[1],
    decimals:  number|undefined  = Number(this.args[2]??0),
    admin:     Address|undefined = this.args[3]??this.context.agent?.address,
    template:  any               = this.args[4]??'amm-snip20'
  ) => {
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
  /** Get a TokenPair object from a string like "SYMBOL1-SYMBOL2"
    * where both symbols are registered */
  pair (name: string): TokenPair {
    const [token_0_symbol, token_1_symbol] = name.split('-')
    return new TokenPair(
      this.get(token_0_symbol).getClientSync().asDescriptor,
      this.get(token_1_symbol).getClientSync().asDescriptor
    )
  }
}

export class TokenError extends CustomError {
  static NoSymbol = this.define('NoSymbol',
    ()=>'Pass a symbol to get a token')
  static NotFound = this.define('NotFound',
    (symbol: string)=>`No token in registry: ${symbol}`)
  static PassToken = this.define('PassToken',
    (symbol: string)=>'Pass a token to register')
  static CantRegister = this.define('CantRegister',
    ()=>"Can't register token without symbol")
  static AlreadyRegistered = this.define('AlreadyRegistered',
    (symbol: string) => 'Token already in registry: ')
}

export * from './tokens-desc'
export * from './tokens-snip20'
