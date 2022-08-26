import * as Fadroma from '@fadroma/client'
import * as Scrt    from '@fadroma/scrt'
import { Console, bold } from '@hackbg/konzola'
import { randomHex } from '@hackbg/formati'

const console = Console('Fadroma Tokens')

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
    contract_addr:    Fadroma.Address
    token_code_hash?: string
  }
}
export function isCustomToken (obj: any): obj is NativeToken {
  return (
    typeof obj                              === 'object' &&
    typeof obj.custom_token                 === 'object' &&
    typeof obj.custom_token.contract_addr   === 'string' &&
    typeof obj.custom_token.token_code_hash === 'string'
  )
}
export function customToken (contract_addr: Fadroma.Address, token_code_hash?: Fadroma.CodeHash) {
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
    readonly amount: Fadroma.Uint128
  ) {}
  /** Pass this to 'send' field of ExecOpts */
  get asNativeBalance (): Fadroma.ICoin[]|undefined {
    let result: Fadroma.ICoin[] | undefined = []
    if (getTokenKind(this.token) == TokenKind.Native) {
      result.push(new Fadroma.Coin(this.amount, (this.token as NativeToken).native_token.denom))
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
  static fromName (knownTokens: Record<string, Token>, name: string): TokenPair {
    const [token_0_symbol, token_1_symbol] = name.split('-')
    const token_0 = knownTokens[token_0_symbol]
    const token_1 = knownTokens[token_1_symbol]
    if (!token_0) {
      throw Object.assign(
        new Error(`TokenPair#fromName: unknown token ${token_0_symbol}`),
        { symbol: token_0_symbol }
      )
    }
    if (!token_1) {
      throw Object.assign(
        new Error(`TokenPair#fromName: unknown token ${token_1_symbol}`),
        { symbol: token_1_symbol }
      )
    }
    return new TokenPair(token_0, token_1)
  }
}

/** A pair of two token descriptors, and amounts of each token, such as when specifying a swap. */
export class TokenPairAmount {

  constructor (
    readonly pair:     TokenPair,
    readonly amount_0: Fadroma.Uint128,
    readonly amount_1: Fadroma.Uint128
  ) {}

  get reverse () {
    return new TokenPairAmount(this.pair.reverse, this.amount_1, this.amount_0)
  }

  /** Pass this to 'send' field of ExecOpts */
  get asNativeBalance () {
    let result: Fadroma.ICoin[] | undefined = []
    if (getTokenKind(this.pair.token_0) == TokenKind.Native) {
      const {native_token:{denom}} = this.pair.token_0 as NativeToken
      result.push(new Fadroma.Coin(this.amount_0, denom))
    } else if (getTokenKind(this.pair.token_1) == TokenKind.Native) {
      const {native_token:{denom}} = this.pair.token_1 as NativeToken
      result.push(new Fadroma.Coin(this.amount_1, denom))
    } else {
      result = undefined
    }
    return result
  }

}

/** # Secret Network SNIP20 token client. */

export interface Snip20BaseConfig {
  name:      string
  symbol:    string
  decimals:  number
}

export interface Snip20InitMsg extends Snip20BaseConfig {
  admin:     Fadroma.Address
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
  [name: string]: unknown
}

export class Snip20 extends Fadroma.Contract implements CustomToken {

  /** Return the address and code hash of this token in the format
    * required by the Factory to create a swap pair with this token */
  get custom_token () {
    if (!this.address) {
      throw new Error("Can't create token reference without address.")
    }
    if (!this.codeHash) {
      throw new Error("Can't create token reference without code hash.")
    }
    return {
      contract_addr:   this.address,
      token_code_hash: this.codeHash
    }
  }

  /** Convert to plain CustomToken. */
  get asDescriptor () {
    return { custom_token: this.custom_token }
  }

  /** Create a SNIP20 token client from a Token descriptor. */
  static fromDescriptor (agent: Fadroma.Executor, descriptor: CustomToken): Snip20 {
    const { custom_token } = descriptor
    const { contract_addr: address, token_code_hash: codeHash } = custom_token
    return new Snip20({ address, codeHash, agent })
  }

  /** Create a SNIP20 init message. */
  static init = (
    name:     string,
    symbol:   string,
    decimals: number,
    admin:    Fadroma.Address|{ address: Fadroma.Address },
    config:   Partial<Snip20InitConfig> = {},
    balances: Array<{address: Fadroma.Address, amount: Fadroma.Uint128}> = []
  ): Snip20InitMsg => {
    if (typeof admin === 'object') admin = admin.address
    return {
      name, symbol, decimals, admin, config,
      initial_balances: balances,
      prng_seed: randomHex(36),
    }
  }

  tokenName:   string  | null = null
  symbol:      string  | null = null
  decimals:    number  | null = null
  totalSupply: Fadroma.Uint128 | null = null

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

  async getBalance (address: Fadroma.Address, key: string) {
    const msg = { balance: { address, key } }
    const response: { balance: { amount: Fadroma.Uint128 } } = await this.query(msg)
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
    owner:   Fadroma.Address, 
    spender: Fadroma.Address,
    key:     string
  ): Promise<Allowance> {
    const msg = { allowance: { owner, spender, key } }
    const response: { allowance: Allowance } = await this.query(msg)
    return response.allowance
  }

  /** Increase allowance to spender */
  increaseAllowance (
    amount:  string | number | bigint,
    spender: Fadroma.Address,
  ) {
    console.info(
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
    spender: Fadroma.Address,
  ) {
    return this.execute({
      decrease_allowance: { amount: String(amount), spender }
    })
  }

  /** Transfer tokens to address */
  transfer (
    amount:    string | number | bigint,
    recipient: Fadroma.Address,
  ) {
    return this.execute({
      transfer: { amount, recipient }
    })
  }

  /** Send tokens to address.
    * Same as transfer but allows for receive callback. */
  send (
    amount:    string | number | bigint,
    recipient: Fadroma.Address,
    callback?: string | object
  ) {
    const callbackB64 = callback
      ? Buffer.from(JSON.stringify(callback)).toString('base64')
      : undefined
    const msg = { send: { amount, recipient, msg: callbackB64 } }
    return this.execute(msg)
  }

  get vk (): Scrt.ViewingKeyClient {
    return new Scrt.ViewingKeyClient(this, { agent: this.agent })
  }

}

export interface Allowance {
  spender:     Fadroma.Address
  owner:       Fadroma.Address
  allowance:   Fadroma.Uint128
  expiration?: number|null
}

export interface TokenInfo {
  name:          string
  symbol:        string
  decimals:      number
  total_supply?: Fadroma.Uint128 | null
}

export type Snip20Permit = Scrt.Permit<'allowance' | 'balance' | 'history' | 'owner'>

export type QueryWithPermit <Q, P> = { with_permit: { query: Q, permit: P } }

export function createPermitMsg <Q> (
  query:  Q,
  permit: Snip20Permit
): QueryWithPermit<Q, Snip20Permit> {
  return { with_permit: { query, permit } }
}

/** Keeps track of real and mock tokens using during stackable deployment procedures. */
export class TokenRegistry {
  static E00 = ()               => new Error('Pass a symbol to get a token')
  static E01 = (symbol: string) => new Error('No token in registry: '+symbol)
  static E02 = ()               => new Error('Pass a token to register')
  static E03 = ()               => new Error("Can't register token without symbol")
  static E04 = (symbol: string) => new Error('Token already in registry: '+symbol)
  /** Command step: add the token registry to the context.
    * Registered as plugin in the local DeployCommands instance. */
  static addToContext = function addTokenRegistryToContext (
    context,
    tokenRegistry = new TokenRegistry(context)
  ) {
    return { tokenRegistry }
  }
  /** Default token config. */
  static defaultConfig: Snip20InitConfig = { public_total_supply: true, enable_mint: true }
  /** Command step: Deploy a single Snip20 token.
    * Exposed below as the "deploy token" command.
    * Invocation is "pnpm run deploy token $name $symbol $decimals [$admin] [$crate]" */
  static deployToken = async function deployToken (
    context:   Context,
    name:      string =                    context.cmdArgs[0]??'MockToken',
    symbol:    string =                    context.cmdArgs[1]??'MOCK',
    decimals:  number =             Number(context.cmdArgs[2]??6),
    admin:     Fadroma.Address|undefined = context.cmdArgs[3]??context.deployment?.agent?.address,
    template:  Fadroma.IntoTemplate      = context.cmdArgs[4]??'amm-snip20'
  ) {
    const args   = context.cmdArgs.slice(5)
    const config = structuredClone(this.defaultConfig)
    if (args.includes('--no-public-total-supply')) delete config.public_total_supply
    if (args.includes('--no-mint'))     delete config.enable_mint
    if (args.includes('--can-burn'))    config.enable_burn    = true
    if (args.includes('--can-deposit')) config.enable_deposit = true
    if (args.includes('--can-redeem'))  config.enable_redeem  = true
    const tokenRegistry = new TokenRegistry(context)
    await this.deployToken(name, symbol, decimals, admin, template)
    return { tokenRegistry: this }
  }
  constructor (
    /** This contains all the deploy API handles. */
    public readonly context: Context
  ) {}
  /** Every thing can get its own Console. Later replace with structured logging. */
  log = Console('Token Registry')
  /** Say that we're deploying a token. */
  logToken = ({ name, symbol, decimals }) =>
    this.log.info(`Deploying token ${bold(name)}: ${symbol} (${decimals} decimals)`)
  /** The collection of token contracts that are known to the deployment. */
  tokens: Record<string, Snip20> = {}
  /** Get a token by symbol. */
  getToken (symbol: string) {
    if (!symbol)                throw TokenRegistry.E00()
    if (!(this.tokens[symbol])) throw TokenRegistry.E01(symbol)
  }
  /** Add a token to the registry. */
  addToken (token: Snip20, symbol: string = token.symbol) {
    if (!token)              throw TokenRegistry.E02()
    if (!symbol)             throw TokenRegistry.E03()
    if (this.tokens[symbol]) throw TokenRegistry.E04(symbol)
    this.tokens[symbol] = token
    return token
  }
  /** Deploy a Snip20 token and add it to the registry. */
  async deployToken (
    name,
    symbol,
    decimals,
    admin, 
    template,
    config: Snip20InitConfig = TokenRegistry.defaultConfig
  ): Promise<Snip20> {
    this.logToken({ name, symbol, decimals })
    // generate snip20 init message
    const init  = Snip20.init(name, symbol, decimals, admin, config)
    // get or create contract with the name (names are internal to deployment)
    const token = await this.context.contract(name, Snip20).getOrDeploy('amm-snip20', init)
    // add and return the token
    return this.addToken(token, symbol)
  }
  /** Deploy multiple Snip20 tokens in one transaction and add them to the registry. */
  async deployTokens (
    tokens:   Snip20BaseConfig[]        = [],
    config:   Snip20InitConfig          = TokenRegistry.defaultConfig,
    template: Fadroma.IntoTemplate      = 'amm-snip20',
    admin:    Fadroma.Address|undefined = this.context.agent.address,
  ): Promise<Snip20[]> {
    tokens.forEach(this.logToken)
    // to deploy multiple contracts of the same type in 1 tx:
    const toDeployArgs = ({name, symbol, decimals})=>
      [name, Snip20.init(name, symbol, decimals, admin, config)] as Fadroma.DeployArgs
    // first generate all the [name, init message] pairs
    const inits    = tokens.map(toDeployArgs)
    // then call `.contracts(optional client class).deployMany(template,[[name,msg],[name,msg]])`
    const deployed = await this.context.contracts(Snip20).deployMany('amm-snip20', inits)
    // post-process the thus deployed tokens:
    for (const i in deployed) {
      // populate metadata for free since we just created them
      deployed[i].tokenName = tokens[i].name
      deployed[i].symbol    = tokens[i].symbol
      deployed[i].decimals  = tokens[i].decimals
      // add to registry
      this.addToken(deployed[i], tokens[i].symbol)
    }
    // return array of `API.Snip20` handles corresponding to input `TokenConfig`s.
    return deployed
  }
}
