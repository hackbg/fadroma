/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
/** The default Git ref when not specified. */
export const HEAD = 'HEAD'

export abstract class Compiler extends Logged {
  /** Whether to enable build caching.
    * When set to false, this compiler will rebuild even when
    * binary and checksum are both present in wasm/ directory */
  caching: boolean = true

  /** Unique identifier of this compiler implementation. */
  abstract id: string

  /** Compile a source.
    * `@hackbg/fadroma` implements dockerized and non-dockerized
    * variants using its `build.impl.mjs` script. */
  abstract build (source: string|Partial<SourceCode>, ...args: unknown[]):
    Promise<CompiledCode>

  /** Build multiple sources.
    * Default implementation of buildMany is sequential.
    * Compiler classes may override this to optimize. */
  async buildMany (inputs: Partial<SourceCode>[]): Promise<CompiledCode[]> {
    const templates: CompiledCode[] = []
    for (const source of inputs) templates.push(await this.build(source))
    return templates
  }
}

export class CompiledCode {
  protected async fetchImpl () {
    if (!this.codePath) {
      throw new Error("can't fetch: codePath not set")
    }
    const request = await fetch(this.codePath!)
    const response = await request.arrayBuffer()
    return new Uint8Array(response)
  }

  /** Compute the code hash if missing; throw if different. */
  async computeHash (): Promise<this & { codeHash: CodeHash }> {
    const hash = CompiledCode.toCodeHash(await this.fetch())
    if (this.codeHash) {
      if (this.codeHash.toLowerCase() !== hash.toLowerCase()) {
        throw new Error(`computed code hash ${hash} did not match preexisting ${this.codeHash}`)
      }
    } else {
      this.codeHash = hash
    }
    return this as this & { codeHash: CodeHash }
  }

  static toCodeHash (data: Uint8Array): string {
    return base16.encode(SHA256(data)).toLowerCase()
  }
}

/** Represents a particular instance of a smart contract.
  *
  * Subclass this to add custom query and transaction methods corresponding
  * to the contract's API. */
export class Contract extends Logged {
  /** Connection to the chain on which this contract is deployed. */
  chain?:    Chain
  /** Connection to the chain on which this contract is deployed. */
  agent?:    Agent
  /** Code upload from which this contract is created. */
  codeId?:   CodeId
  /** The code hash uniquely identifies the contents of the contract code. */
  codeHash?: CodeHash
  /** The address uniquely identifies the contract instance. */
  address?:  Address
  /** The label is a human-friendly identifier of the contract. */
  label?:    Label
  /** The address of the account which instantiated the contract. */
  initBy?:   Address

  constructor (properties: Partial<Contract>) {
    super((typeof properties === 'string')?{}:properties)
    if (typeof properties === 'string') {
      properties = { address: properties }
    }
    assign(this, properties, [
      'chain',
      'agent',
      'codeId',
      'codeHash',
      'address',
      'label',
      'initBy'
    ])
  }

  /** Execute a query on the specified instance as the specified Connection. */
  query <Q> (message: Message): Promise<Q> {
    if (!this.chain) {
      throw new Error("can't query instance without connection")
    }
    if (!this.address) {
      throw new Error("can't query instance without address")
    }
    return this.chain.query<Q>(this as { address: Address }, message)
  }

  /** Execute a transaction on the specified instance as the specified Connection. */
  execute (message: Message, options: Parameters<Agent["execute"]>[2] = {}): Promise<unknown> {
    if (!this.chain) {
      throw new Error("can't transact with instance without connection")
    }
    if (!this.agent?.execute) {
      throw new Error("can't transact with instance without authorizing the connection")
    }
    if (!this.address) {
      throw new Error("can't transact with instance without address")
    }
    return this.agent?.execute(this as { address: Address }, message, options)
  }
}

/** A constructable gas fee in native tokens. */
export class Fee implements IFee {
  amount: ICoin[] = []
  constructor (
    amount: Uint128|number|bigint, denom: string, public gas: string = String(amount)
  ) {
    this.add(amount, denom)
  }
  add (amount: Uint128|number|bigint, denom: string) {
    this.amount.push({ amount: String(amount), denom })
  }

  get [Symbol.toStringTag] () {
    let tag = `${this.gas}`
    if (this.amount.length > 0) {
      tag += ' ('
      return this.amount.map(({ amount, denom })=>{
        return `${amount} ${denom}`
      }).join('|')
      tag += ')'
    }
    return tag
  }
}

/** Represents some amount of native token. */
export class Coin implements ICoin {
  readonly amount: string
  constructor (amount: number|string, readonly denom: string) {
    this.amount = String(amount)
  }
}

abstract class Token {
  /** The token's unique id. */
  abstract get id (): string
  /** Whether this token is fungible. */
  abstract isFungible (): this is FungibleToken
}

abstract class NonFungibleToken extends Token {
  /** @returns false */
  isFungible = () => false
}

abstract class FungibleToken extends Token {
  /** @returns true */
  isFungible = () => true
  /** Whether this token is natively supported by the chain. */
  abstract isNative (): this is NativeToken
  /** Whether this token is implemented by a smart contract. */
  abstract isCustom (): this is CustomToken

  static readonly addZeros = (n: number|Uint128, z: number): Uint128 => {
    return `${n}${[...Array(z)].map(() => '0').join('')}`
  }

  amount (amount: number|Uint128): TokenAmount {
    return new TokenAmount(amount, this)
  }
}

/** An amount of a fungible token. */
class TokenAmount {
  public amount: Uint128
  constructor (amount: string|number|bigint, public token: FungibleToken) {
    this.amount = String(amount)
  }
  /** Pass this to send, initSend, execSend */
  get asNativeBalance (): ICoin[] {
    if (this.token.isNative()) {
      return [new Coin(this.amount, this.token.denom)]
    }
    return []
  }

  get denom () {
    return this.token?.id
  }

  get [Symbol.toStringTag] () {
    return this.toString()
  }

  toString () {
    return `${this.amount??''} ${this.token?.id??''}`
  }

  asCoin (): ICoin {
    if (!this.token.isNative()) {
      throw new Error(`not a native token: ${this.toString()}`)
    }
    return { amount: this.amount, denom: this.denom }
  }

  asFee (gas: Uint128 = this.amount): IFee {
    if (!this.token.isNative()) {
      throw new Error(`not a native token: ${this.toString()}`)
    }
    return { amount: [this.asCoin()], gas }
  }
}

class NativeToken extends FungibleToken {
  constructor (readonly denom: string) { super() }
  /** The token's unique id. */
  get id () { return this.denom }
  /** @returns false */
  isCustom = () => false
  /** @returns true */
  isNative = () => true

  fee (amount: string|number|bigint): IFee {
    return new Fee(amount, this.id)
  }
}

class CustomToken extends FungibleToken {
  constructor (readonly address: Address, readonly codeHash?: string) { super() }
  /** The token contract's address. */
  get id () { return this.address }
  /** @returns true */
  isCustom = () => true
  /** @returns false */
  isNative = () => false
}

class TokenPair {
  constructor (readonly a: Token, readonly b: Token) {}
  /** Reverse the pair. */
  get reverse (): TokenPair {
    return new TokenPair(this.b, this.a)
  }
}

class TokenSwap {
  constructor (
    readonly a: TokenAmount|NonFungibleToken,
    readonly b: TokenAmount|NonFungibleToken
  ) {}
  /** Reverse the pair. */
  get reverse (): TokenSwap {
    return new TokenSwap(this.b, this.a)
  }
}

export class UploadStore extends Map<CodeHash, UploadedCode> {
  log = new Console(this.constructor.name)

  constructor () {
    super()
  }

  get (codeHash: CodeHash): UploadedCode|undefined {
    return super.get(codeHash)
  }

  set (codeHash: CodeHash, value: Partial<UploadedCode>): this {
    if (!(value instanceof UploadedCode)) {
      value = new UploadedCode(value)
    }
    if (value.codeHash && (value.codeHash !== codeHash)) {
      throw new Error('tried to store upload under different code hash')
    }
    return super.set(codeHash, value as UploadedCode)
  }
}

/** The `CompiledCode` class has an alternate implementation for non-browser environments.
  * This is because Next.js tries to parse the dynamic `import('node:...')` calls used by
  * the `fetch` methods. (Which were made dynamic exactly to avoid such a dual-implementation
  * situation in the first place - but Next is smart and adds a problem where there isn't one.)
  * So, it defaults to the version that can only fetch from URL using the global fetch method;
  * but the non-browser entrypoint substitutes `CompiledCode` in `_$_HACK_$_` with the
  * version which can also load code from disk (`LocalCompiledCode`). Ugh. */
//export const _$_HACK_$_ = { CompiledCode: CompiledCode }
