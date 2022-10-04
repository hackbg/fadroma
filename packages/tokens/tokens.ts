import {
  Address,
  Agent,
  Client,
  ClientConsole,
  CodeHash,
  Coin,
  Contract,
  DeployArgs,
  Deployment,
  ICoin,
  Label,
  Uint128,
} from '@fadroma/client'
import {
  Permit,
  ViewingKeyClient
} from '@fadroma/scrt'
import {
  CustomError,
  bold,
  colors
} from '@hackbg/konzola'
import {
  randomBase64
} from '@hackbg/formati'
import {
  Task,
  CommandContext,
} from '@hackbg/komandi'

const log = new ClientConsole('Fadroma.TokenManager')

export type Tokens = Record<string, Snip20|Token>
/** # Token descriptors. */

/** There are two kinds of token supported:
  * - the chain's native token, in a specific denomination
  * - contract-based custom tokens. */
export enum TokenKind {
  Native = "TokenKind.Native",
  Custom = "TokenKind.Custom"
}

/** Return the kind of a token specified in the passed token descriptor. */
export function getTokenKind (token: Token): TokenKind {
  return (token.hasOwnProperty('native_token')) ? TokenKind.Native : TokenKind.Custom
}

/** Extract some comparable id from the token type:
  * - the string "native" if it's the chain's native token
  * - the address of the token, if it's a custom token */
export function getTokenId (token: Token): string {
  if ((token as NativeToken).native_token) {
    return "native";
  }
  const address = (token as CustomToken).custom_token?.contract_addr;
  if (!address) {
    throw new Error("Token descriptor is not correct, missing address");
  }
  return address;
}

/** Token descriptor. Specifies kind (native or custom) and identity of token (denom/addr+hash) */
export type Token = NativeToken | CustomToken;

export function isTokenDescriptor (obj: any): obj is Token {
  return isNativeToken(obj) || isCustomToken(obj)
}

/** Native token. Supported natively by the underlying blockchain. */
export interface NativeToken {
  native_token: {
    denom: string
  }
}

export function isNativeToken (obj: any): obj is NativeToken {
  return (
    typeof obj === 'object' &&
    typeof obj.native_token === 'object' &&
    typeof obj.native_token.denom === 'string'
  )
}

export function nativeToken (denom: string) {
  return { native_token: { denom } }
}

/** Custom token. Implemented as a smart contract in the blockchain's compute module. */
export interface CustomToken {
  custom_token: {
    contract_addr:    Address
    token_code_hash?: string
  }
}

export function isCustomToken (obj: any): obj is CustomToken {
  return (
    typeof obj                              === 'object' &&
    typeof obj.custom_token                 === 'object' &&
    typeof obj.custom_token.contract_addr   === 'string' &&
    typeof obj.custom_token.token_code_hash === 'string'
  )
}

export function customToken (contract_addr: Address, token_code_hash?: CodeHash) {
  return { custom_token: { contract_addr, token_code_hash } }
}

export interface NativeToken {
  native_token: {
    denom: string
  }
}

/** Token amount descriptor. Specifies a particular amount of a particular token. */
export class TokenAmount {
  constructor (
    readonly token:  Token,
    readonly amount: Uint128
  ) {}
  /** Pass this to 'send' field of ExecOpts */
  get asNativeBalance (): ICoin[]|undefined {
    let result: ICoin[] | undefined = []
    if (getTokenKind(this.token) == TokenKind.Native) {
      result.push(new Coin(this.amount, (this.token as NativeToken).native_token.denom))
    } else {
      result = undefined
    }
    return result
  }
}

/** A pair of two token descriptors. */
export class TokenPair {
  constructor (readonly token_0: Token, readonly token_1: Token) {}
  get reverse (): TokenPair { return new TokenPair(this.token_1, this.token_0) }
}

/** A pair of two token descriptors, and amounts of each token, such as when specifying a swap. */
export class TokenPairAmount {

  constructor (
    readonly pair:     TokenPair,
    readonly amount_0: Uint128,
    readonly amount_1: Uint128
  ) {}

  get reverse () {
    return new TokenPairAmount(this.pair.reverse, this.amount_1, this.amount_0)
  }

  /** Pass this to 'send' field of ExecOpts */
  get asNativeBalance () {
    let result: ICoin[] | undefined = []
    if (getTokenKind(this.pair.token_0) == TokenKind.Native) {
      const {native_token:{denom}} = this.pair.token_0 as NativeToken
      result.push(new Coin(this.amount_0, denom))
    } else if (getTokenKind(this.pair.token_1) == TokenKind.Native) {
      const {native_token:{denom}} = this.pair.token_1 as NativeToken
      result.push(new Coin(this.amount_1, denom))
    } else {
      result = undefined
    }
    return result
  }

}

export type TokenSymbol = string

export interface TokenOptions {
  template?: Partial<Contract<Snip20>>
  name:      string
  decimals:  number
  admin:     Address,
  config?:   Snip20InitConfig
}

/** Keeps track of real and mock tokens using during stackable deployment procedures. */
export class TokenManager extends CommandContext {
  constructor (
    /** Function that returns the active deployment. */
    public context: Deployment,
    /** Template for deploying new tokens. */
    public template?: Contract<Snip20>,
    /** Default token config. */
    public defaultConfig: Snip20InitConfig = {
      public_total_supply: true,
      enable_mint:         true
    }
  ) {
    super('tokens', 'token manager')
    Object.defineProperty(this, 'log', { enumerable: false, writable: true })
  }
  /* Logger. */
  log = log
  /** Collection of known tokens in descriptor format, keyed by symbol. */
  tokens: Record<TokenSymbol, Contract<Snip20>> = {}
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
    return this.tokens[symbol] = token
  }
  /** Define a Snip20 token. */
  contract (options: Partial<Contract<Snip20>>): Contract<Snip20> {
    return this.context.contract(this.template).provide(options)
  }
  /** Define a Snip20 token, get/deploy it, and add it to the registry. */
  define (symbol: TokenSymbol, options?: Partial<TokenOptions>):
    Task<Contract<Snip20>, Snip20>
  /** Define multiple Snip20 tokens, keyed by symbol. */
  define (tokens: Record<TokenSymbol, Partial<TokenOptions>>):
    Task<Deployment, Record<TokenSymbol, Snip20>>
  define (...args: unknown[]): Promise<unknown> {

    if (typeof args[0] === 'string') {

      const [symbol, options] = args as [TokenSymbol, Partial<TokenOptions>|undefined]
      if (this.has(symbol)) return Promise.resolve(this.tokens[symbol])
      return this.add(symbol, this.contract({ name: options?.name })).deploy(Snip20.init(
        options?.name     ?? symbol,
        symbol,
        options?.decimals ?? 8,
        options?.admin    ?? this.context.agent!.address!,
        options?.config
      ))

    } else if (typeof args[0] === 'object') {

      const definitions = args[0] as Record<TokenSymbol, Partial<TokenOptions>>
      const tokens: Record<TokenSymbol, Task<Contract<Snip20>, Snip20>> = {}
      const deploy: Record<TokenSymbol, DeployArgs> = {}
      const bundle = this.context.agent!.bundle()
      for (let [symbol, options] of Object.entries(definitions)) {
        if (this.has(symbol)) {
          tokens[symbol] = this.tokens[symbol]
        } else {
          options          ??= {}
          options.name     ??= symbol
          options.decimals ??= 8
          options.admin    ??= this.context.agent!.address!
          deploy[symbol] = [
            options.name,
            Snip20.init(options.name, symbol, options.decimals, options.admin, options.config)
          ]
        }
      }
      return this.context.task(`deploy ${Object.keys(deploy).length} tokens`, async () => {
        const results: Record<string, Snip20> = {}
        for (const [symbol, client] of Object.entries(tokens)) {
          results[symbol] = await client
        }
        const entries  = Object.entries(deploy)
        const deployed = await this.context
          .contracts(this.template!)
          .provide({ inits: entries.map(x=>x[1]) })
        for (const i in entries) {
          const [symbol] = entries[i]
          const  client = deployed[i]
          results[symbol] = client
          this.add(symbol, client.asContract.provide({ deployment: this.context }))
        }
        return { ...tokens, ...results }
      })

    } else {
      throw new Error('Tokens#define: invalid invocation')
    }
  }
  /** Command step: Deploy a single Snip20 token.
    * Exposed below as the "deploy token" command.
    * Invocation is "pnpm run deploy token $name $symbol $decimals [$admin] [$crate]" */
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

/** # Secret Network SNIP20 token client. */

export interface Snip20BaseConfig {
  name:     string
  symbol:   string
  decimals: number
}

export interface Snip20InitMsg extends Snip20BaseConfig {
  admin:     Address
  prng_seed: string
  config:    Snip20InitConfig
  // Allow to be cast as Record<string, unknown>:
  [name: string]: unknown
}

export interface Snip20InitConfig {
  public_total_supply?: boolean
  enable_mint?:         boolean
  enable_burn?:         boolean
  enable_deposit?:      boolean
  enable_redeem?:       boolean
  // Allow unknown properties:
  [name: string]:       unknown
}

export class Snip20 extends Client implements CustomToken {

  /** Return the address and code hash of this token in the format
    * required by the Factory to create a swap pair with this token */
  get custom_token () {
    if (!this.address)  throw new Error("Can't create token reference without address.")
    if (!this.codeHash) throw new Error("Can't create token reference without code hash.")
    return {
      contract_addr:   this.address,
      token_code_hash: this.codeHash
    }
  }

  /** Convert to a plain CustomToken with a *hidden (from serialization!)*
    * reference to the Client which produced it. */
  get asDescriptor () {
    return Object.defineProperty({
      custom_token: this.custom_token,
      client:       this
    }, 'client', {
      enumerable: false
    })
  }

  /** Create a SNIP20 token client from a Token descriptor. */
  static fromDescriptor (agent: Agent, descriptor: CustomToken): Snip20 {
    const { custom_token } = descriptor
    const { contract_addr: address, token_code_hash: codeHash } = custom_token
    return new Snip20(agent, address, codeHash)
  }

  /** Create a SNIP20 init message. */
  static init = (
    name:     string,
    symbol:   string,
    decimals: number,
    admin:    Address|{ address: Address },
    config:   Partial<Snip20InitConfig> = {},
    balances: Array<{address: Address, amount: Uint128}> = []
  ): Snip20InitMsg => {
    if (typeof admin === 'object') admin = admin.address
    return {
      name,
      symbol,
      decimals,
      admin,
      config,
      initial_balances: balances,
      prng_seed:        randomBase64(),
    }
  }

  tokenName:   string  | null = null
  symbol:      string  | null = null
  decimals:    number  | null = null
  totalSupply: Uint128 | null = null

  async populate (): Promise<this> {
    await super.populate()
    const { name, symbol, decimals, total_supply } = await this.getTokenInfo()
    this.tokenName   = name
    this.symbol      = symbol
    this.decimals    = decimals
    this.totalSupply = total_supply || null
    return this
  }

  async getTokenInfo () {
    const msg = { token_info: {} }
    const { token_info }: { token_info: TokenInfo } = await this.query(msg)
    return token_info
  }

  async getBalance (address: Address, key: string) {
    const msg = { balance: { address, key } }
    const response: { balance: { amount: Uint128 } } = await this.query(msg)
    if (response.balance && response.balance.amount) {
      return response.balance.amount
    } else {
      throw new Error(JSON.stringify(response))
    }
  }

  checkAllowance (spender: string, owner: string, key: string) {
    return this.query({ check_allowance: { owner, spender, key } })
  }

  /** Change the admin of the token, who can set the minters */
  changeAdmin (address: string) {
    return this.execute({ change_admin: { address } })
  }

  /** Set specific addresses to be minters, remove all others */
  setMinters (minters: Array<string>) {
    return this.execute({ set_minters: { minters } })
  }

  /** Add addresses to be minters */
  addMinters (minters: Array<string>) {
    return this.execute({
      add_minters: { minters, padding: null }
    })
  }

  /** Mint tokens */
  mint (
    amount:    string | number | bigint,
    recipient: string | undefined = this.agent?.address
  ) {
    if (!recipient) {
      throw new Error('Snip20#mint: specify recipient')
    }
    return this.execute({
      mint: { amount: String(amount), recipient, padding: null }
    })
  }

  async getAllowance (
    owner:   Address,
    spender: Address,
    key:     string
  ): Promise<Allowance> {
    const msg = { allowance: { owner, spender, key } }
    const response: { allowance: Allowance } = await this.query(msg)
    return response.allowance
  }

  /** Increase allowance to spender */
  increaseAllowance (
    amount:  string | number | bigint,
    spender: Address,
  ) {
    log.info(
      `${bold(this.agent?.address||'(missing address)')}: increasing allowance of`,
      bold(spender), 'by', bold(String(amount)), bold(String(this.symbol||this.address))
    )
    return this.execute({
      increase_allowance: { amount: String(amount), spender }
    })
  }

  /** Decrease allowance to spender */
  decreaseAllowance (
    amount:  string | number | bigint,
    spender: Address,
  ) {
    return this.execute({
      decrease_allowance: { amount: String(amount), spender }
    })
  }

  /** Transfer tokens to address */
  transfer (
    amount:    string | number | bigint,
    recipient: Address,
  ) {
    return this.execute({
      transfer: { amount, recipient }
    })
  }

  /** Send tokens to address.
    * Same as transfer but allows for receive callback. */
  send (
    amount:    string | number | bigint,
    recipient: Address,
    callback?: string | object
  ) {
    const callbackB64 = callback
      ? Buffer.from(JSON.stringify(callback)).toString('base64')
      : undefined
    const msg = { send: { amount, recipient, msg: callbackB64 } }
    return this.execute(msg)
  }

  get vk (): ViewingKeyClient {
    return new ViewingKeyClient(this.agent, this.address, this.codeHash)
  }

}

export interface Allowance {
  spender:     Address
  owner:       Address
  allowance:   Uint128
  expiration?: number|null
}

export interface TokenInfo {
  name:          string
  symbol:        string
  decimals:      number
  total_supply?: Uint128 | null
}

export type Snip20Permit = Permit<'allowance' | 'balance' | 'history' | 'owner'>

export type QueryWithPermit <Q, P> = { with_permit: { query: Q, permit: P } }

export function createPermitMsg <Q> (
  query:  Q,
  permit: Snip20Permit
): QueryWithPermit<Q, Snip20Permit> {
  return { with_permit: { query, permit } }
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
