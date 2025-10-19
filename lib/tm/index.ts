/** Fadroma. Copyright (C) 2023-2025 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import type {
  Context, Block, Height, Coin, Fee,
  BlockResponse, BlockResults, BlockResultsResponse,
  Fungible, TokenApi, Token,
} from './types.ts';
import { Core, base16, base64, uint32, camelize } from './deps.ts';
import type { Address, Hash, Uint128 } from './deps.ts';

const BaseError = globalThis.Error;

/** A Tendermint error .*/
export class Error extends BaseError {
  constructor (message, ...args: object[]) {
    super(message); Object.assign(this, ...args);
  }
  static TODO = (...args: string[]) => {
    throw Object.assign(new Error(['TODO', ...args].join(' ')), { todo: true })
  }
}

/** Describe a Tendermint chain. */
export const chain = ({ ...options }: Partial<Core.Chain> & ChainOptions, api = impl): Chain =>
  Core.chain(options, api as any) as Chain

/** Fetch a block from a Tendermint chain, optionally with block results. */
export const fetch = (api: Context) => ({

  async block (options?: {
    height?: Height, hash?: string, results?: boolean, raw?: boolean
  }): Promise<Block> {
    const [
      [blockUrl,   [blockText,   block,   blockError  ]],
      [resultsUrl, [resultsText, results, resultsError]]=[undefined, []]
    ] = await Promise.all((options?.results)
      ?[fetchAndTryToParseBlockResponse(api, options), fetchAndTryToParseResultsResponse(api, options)]
      :[fetchAndTryToParseBlockResponse(api, options)])
    if (blockError) {
      api.log.error('failed to decode block:', blockError)
      if (!options?.raw) throw new Error('failed to decode block', { reason: blockError })
    }
    if ('error' in block!) {
      api.log.error('block error:', blockError)
      if (!options?.raw) throw new Error('fetched block error', { reason: block.error })
    }
    if (options?.results) {
      if (resultsError) {
        api.log.error('failed to decode block results:', resultsError)
        if (!options?.raw) throw new Error('failed to decode block results', { reason: resultsError })
      }
      if ('error' in results!) {
        api.log.error('results error:', resultsError)
        if (!options?.raw) throw new Error('fetched results error', { reason: results.error })
      }
    }
    return {
      chain:        api.chain(),
      id:           block!.result!.block_id.hash,
      height:       block!.result!.block.header.height,
      header:       block!.result!.block.header,
      transactions: block!.result!.block.data.txs,
      results:      options?.results ? camelize(results!.result!) : undefined,
      responses:    options?.raw     ? {
        block:   { url: blockUrl,   data: blockText   },
        results: { url: resultsUrl, data: resultsText },
      } : undefined
    } as Block
  },


  /** Fetch just the results of a Tendermint block. */
  async blockResults (options?: {
    height?: Height, raw?: boolean
  }): Promise<BlockResults> {
    const [_, [resultsText, results, resultsError]] =
      await fetchAndTryToParseResultsResponse(api, options)
    if (resultsError) {
      api.log.error('failed to decode block results:', resultsError)
      if (!options?.raw) throw new Error('failed to decode block results', { reason: resultsError })
    }
    if ('error' in results!) {
      api.log.error('results error:', resultsError)
      if (!options?.raw) throw new Error('results error', { reason: results.error })
    }
    return Object.assign(camelize(results!.result!) as unknown as BlockResults, {
      raw: options?.raw ? resultsText : undefined
    })
  },

  async abciInfo (_api: Context) { Error.TODO('fetchAbciInfo') },

  async abciQuery (api: Context, path: string, options?: {
    data?: Uint8Array, height?: Height, prove?: boolean
  }): Promise<{
    readonly key:       Uint8Array|null
    readonly value:     Uint8Array|null
    readonly codespace: string
    readonly info:      string
    readonly proof?:    Array<{ type: string, key: Uint8Array, data: Uint8Array }>
    readonly height?:   number
    readonly index?:    number
    readonly code?:     number // non-falsy for errors
    readonly log?:      string
  }> {
    if (!api.url) throw new Error('fetchAbciQuery: no api url')
    if (!path) throw new Error('fetchAbciQuery: no path')
    const data     = options?.data || new Uint8Array()
    const params   = {path, data: base16.encode(data), prove: options?.prove ?? false, height: options?.height}
    const message  = {jsonrpc: '2.0', id: Console.randomId(), method: 'abci_query', params}
    const headers  = {'Content-Type': 'application/json'}
    const body     = JSON.stringify(message)
    api.log.debug('fetchAbciQuery:', body)
    const request  = await fetch(api.url, {method: 'POST', body, headers})
    const json     = await request.json()
    const { result: { response }, error } = json
    if (error) {
      api.log.error('fetchAbciQuery error:', error)
      throw new Error('fetchAbciQueryError', { error })
    }
    if (typeof response.key   === 'string') response.key   = base64.decode(response.key)
    if (typeof response.value === 'string') response.value = base64.decode(response.value)
    return response
  },

  async blockSearch (_query: string, _parameters: { page?: number, perPage?: number, orderBy?: string }) { return Error.TODO('fetchBlockSearch') },
  async blockchain (_parameters: { min?: Height, max?: Height }) { return Error.TODO('fetchBlockchain') },
  async commit (_height: Height) { return Error.TODO('fetchCommit') },
  async genesis () { return Error.TODO('fetchGenesis') },
  async health () { return Error.TODO('fetchHealth') },
  async numUnconfirmedTxs () { return Error.TODO('fetchNumUnconfirmedTxs') },
  async status () { return Error.TODO('fetchStatus') },
  async tx () { return Error.TODO('fetchTx') },
  async txSearch () { return Error.TODO('fetchTxSearch') }
});

const fetchAndTryToParseBlockResponse =
  async (api: Context, options?: { height?: Height, hash?: string }):
    Promise<[string, Core.TryToParse<string, BlockResponse>]> => {
      if (!api.url) throw new Error("missing connection URL: can't fetch block")
      const { height, hash } = options || {}
      if (hash) throw new Error("can't fetch block by hash yet")
      if (height && isNaN(Number(height))) throw new Error(`invalid height requested: ${height}`)
      const url = `${api.url}/block?height=${height??''}`
      const response = await fetch(url).then(r=>r.text())
      return [url, Core.tryToParse(response)] }
const fetchAndTryToParseResultsResponse =
  async (api: Context, options?: { height?: Height }):
    Promise<[string, Core.TryToParse<string, BlockResultsResponse>]> => {
      if (!api.url) throw new Error("missing connection URL: can't fetch block results")
      const { height } = options || {}
      const url = `${api.url}/block_results?height=${height??''}`
      const response = await fetch(url).then(r=>r.text())
      return [url, Core.tryToParse(response)] }

export const subscribe = async (_api: Context, _subscribeTo: 'block'|'header'|{query: string}) =>
  Error.TODO('subscribe')
export const broadcastTx = async (_api: Context, _method: 'sync'|'async'|'commit', _tx: Uint8Array) =>
  Error.TODO('broadcastTx')
export const fetchBalance = (...args: unknown[]) =>
  Error.TODO('tendermint fetch native balance')
export const send = (...args: unknown[]) =>
  Error.TODO('tendermint native send')
//import type { Address } from '../deps.ts'
//import { optionallyParallel } from '../deps.ts'

//export function fetchBalance (chain: Chain, ...args: Parameters<Chain["fetchBalance"]>) {
  //const requests: Record<Address, string[]> = {}
  //if (args[0] && !(args[0] instanceof Array)) {
    //args[0] = [args[0]]
  //}
  //if (args[0]) {
    //for (const address of args[0] as Address[]) {
      //requests[address] ??= []
      //if (args[1] as any instanceof Array) {
        //for (const token of args[1]!) {
          //requests[address].push(token)
        //}
      //} else if (args[1]) {
        //requests[address].push(args[1])
      //}
    //}
  //}
  //return fetchBalanceImpl(chain.getConnection(), {
    //addresses: requests
  //})
//}

//export async function fetchBalanceImpl (chain: CWConnection, {
  //parallel = false,
  //addresses,
//}: Parameters<Connection["fetchBalanceImpl"]>[0]) {
  //const queries = []
  //for (const [address, tokens] of Object.entries(addresses)) {
    //for (const token of tokens) {
      //queries.push(()=>chain.api.getBalance(address, token).then(balance=>({
        //address, token, balance
      //})))
    //}
  //}
  //const result: Record<Address, Record<string, string>> = {}
  //const responses = await optionallyParallel(parallel, queries)
  //for (const { address, token, balance } of responses) {
    //result[address] ??= {}
    //result[address][token] = balance.amount
  //}
  //return result
//}

  ////[>* Get balance of current identity in main token. <]
  ////get balance () {
    ////if (!chain.identity?.address) {
      ////throw new Error('not authenticated, use .getBalance(token, address)')
    ////} else if (!chain.defaultDenom) {
      ////throw new Error('no default token for chain chain, use .getBalance(token, address)')
    ////} else {
      ////return chain.getBalanceOf(chain.identity.address)
    ////}
  ////}
  /** Get the balance in a native token of a given address,
    * either in chain connection's gas token,
    * or in another given token. */
  ////getBalanceOf (address: Address|{ address: Address }, token?: string) {
    ////if (!address) {
      ////throw new Error('pass (address, token?) to getBalanceOf')
    ////}
    ////token ??= chain.defaultDenom
    ////if (!token) {
      ////throw new Error('no token for balance query')
    ////}
    ////const addr = (typeof address === 'string') ? address : address.address
    ////if (addr === chain.identity?.address) {
      ////chain.log.debug('Querying', bold(token), 'balance')
    ////} else {
      ////chain.log.debug('Querying', bold(token), 'balance of', bold(addr))
    ////}
    ////return timed(
      ////chain.doGetBalance.bind(chain, token, addr),
      ////({ elapsed, result }) => chain.log.debug(
        ////`Queried in ${elapsed}s: ${bold(address)} has ${bold(result)} ${token}`
      ////)
    ////)
  ////}
  /** Get the balance in a given native token, of
    * either chain connection's identity's address,
    * or of another given address. */
  ////getBalanceIn (token: string, address?: Address|{ address: Address }) {
    ////if (!token) {
      ////throw new Error('pass (token, address?) to getBalanceIn')
    ////}
    ////address ??= chain.identity?.address
    ////if (!address) {
      ////throw new Error('no address for balance query')
    ////}
    ////const addr = (typeof address === 'string') ? address : address.address
    ////if (addr === chain.identity?.address) {
      ////chain.log.debug('Querying', bold(token), 'balance')
    ////} else {
      ////chain.log.debug('Querying', bold(token), 'balance of', bold(addr))
    ////}
    ////return timed(
      ////chain.doGetBalance.bind(chain, token, addr),
      ////({ elapsed, result }) => chain.log.debug(
        ////`Queried in ${elapsed}s: balance of ${bold(address)} is ${bold(result)}`
      ////)
    ////)
  ////}
  ////[>* Fetch balance of 1 or many addresses in 1 or many native tokens. <]
  ////fetchBalance (address: Address, token: string):
    ////Promise<Uint128>
  ////fetchBalance (address: Address, tokens?: string[]):
    ////Promise<Record<string, Uint128>>
  ////fetchBalance (addresses: Address[], token: string):
    ////Promise<Record<Address, Uint128>>
  ////fetchBalance (addresses: Address[], tokens?: string):
    ////Promise<Record<Address, Record<string, Uint128>>>
  ////async fetchBalance (...args: unknown[]): Promise<unknown> {
    ////return fetchBalance(this, ...args as Parameters<Chain["fetchBalance"]>)
  ////}
////}

  ////abstract fetchBalanceImpl (parameters: {
    ////addresses: Record<Address, string[]>,
    ////parallel?: boolean
  ////}): Promise<Record<Address, Record<string, Uint128>>>
//import type { Address } from '../deps.ts'
//import { optionallyParallel } from '../deps.ts'

//[>* Send one or more kinds of native tokens to one or more recipients. <]
//export async function send (
  //outputs:  Record<Address, Record<string, Uint128>>,
  //options?: Omit<Parameters<SigningConnection["sendImpl"]>[0],
    //'outputs'>
//): Promise<unknown> {
  //return send(this, outputs, options)
//}


//export async function send2 (agent: Agent, ...args: Parameters<Agent["send"]>) {
  //const [outputs, options] = args
  //for (const [recipient, amounts] of Object.entries(outputs)) {
    //agent.log.debug(`Sending to ${bold(recipient)}:`)
    //for (const [token, amount] of Object.entries(amounts)) {
      //agent.log.debug(`  ${amount} ${token}`)
    //}
  //}
  //return await timed(
    //()=>sendImpl(agent.getConnection(), {
      //...options||{},
      //outputs
    //}),
    //({elapsed})=>`Sent in ${bold(elapsed)}`
  //)
//}

//export async function sendImpl (agent: CWSigningConnection, {
  //parallel = false,
  //outputs,
  //sendFee,
  //sendMemo,
//}: Parameters<SigningConnection["sendImpl"]>[0]) {
  //const sender = agent.address
  //const transactions = []
  //for (const [recipient, amounts] of Object.entries(outputs)) {
    //transactions.push(()=>agent.api.sendTokens(
      //sender,
      //recipient,
      //Object.entries(amounts).map(([denom, amount])=>({amount, denom})),
      //sendFee || 'auto',
      //sendMemo
    //).then(transaction=>({
      //sender, recipient, amounts, transaction
    //})))
  //}
  //const result: Record<Address, {
    //sender:      Address,
    //recipient:   Address,
    //amounts:     Record<string, string>
    //transaction: unknown
  //}> = {}
  //const responses = await optionallyParallel(parallel, transactions)
  //for (const response of responses) {
    //result[response.recipient] = response
  //}
  //return result
//}
/** A Tendermint logger .*/
export class Console extends Core.Console {
  static randomId = (): number => parseInt(Array.from({ length: 12 }) .map(() => randomNumericChar()).join(""), 10)
}
const numbersWithoutZero = "123456789"
const randomNumericChar = (): string => numbersWithoutZero[Math.floor(Math.random() * numbersWithoutZero.length)]
/** A Namada validator. */
export interface Validator {
  address?: Address,
  publicKey?: Hash,
  votingPower: bigint,
  proposerPriority: bigint
}
export type FetchValidatorOptions = {
  height?: Core.Height,
  details?: boolean,
  pagination?: [number, number],
}
export async function fetchValidators <V extends Validator> (
  api: Api & Context, options?: FetchValidatorOptions
): Promise<[V[], number, number]> {
  if (!api.url) throw new Error('fetchValidators: no api url')
  const { height, pagination: [page, per_page] = [], details } = options || {}
  const params  = {height, page: String(page||1), per_page: String(per_page||10)}
  const message = {jsonrpc: '2.0', id: Console.randomId(), method: 'validators', params}
  const headers = {'Content-Type': 'application/json'}
  const body    = JSON.stringify(message)
  api.log.debug('fetchValidators:', body)
  const request = await fetch(api.url, {method: 'POST', body, headers})
  const json    = await request.json()
  const { result, error } = json
  if (error) {
    api.log.error('fetchValidators error:', error)
    throw new Error('fetchValidatorsError', { error })
  }
  // Sort validators by voting power in descending order.
  const validators = [...result.validators].sort(byVotingPowerDesc)
  // Fetch more validator details if requested. TODO parallel.
  if (details) {
    // FIXME: Which chains respond to this ABCI query? It's from Stargate
    for (const validator of validators) {
      const details = await api.fetchAbciQuery('/cosmos.staking.v1beta1.Query/Validator', { data: new Uint8Array([
        ...new Uint8Array(uint32.fixedEncoder(10).bytes),
        ...new Uint8Array(uint32.fixedEncoder(validator.address.length).bytes),
        ...new TextEncoder().encode(validator.address)
      ]) })
      throw {validator, details}
    }
  }
  return [validators, result.count, result.total]
  //let response
  //if (pagination && (pagination as Array<number>).length !== 0) {
    //if (pagination.length !== 2) {
      //throw new Error("pagination format: [page, per_page]")
    //}
    //response = await tendermintClient!.validators({
      //page:     pagination[0],
      //per_page: pagination[1],
    //})
  //} else {
    //response = await tendermintClient!.validatorsAll()
  //}
}

export const byVotingPowerDesc = (a: Validator, b: Validator)=>(
  (a.votingPower < b.votingPower) ?  1 :
  (a.votingPower > b.votingPower) ? -1 : 0
)

//const writeVarint32 = (val: number, buf: Uint8Array, pos: number) => {
    //while (val > 127) {
        //buf[pos++] = val & 127 | 128;
        //val >>>= 7;
    //}
    //buf[pos] = val;
//}
/** Convert to coin. */
export const makeCoin = (amount: Uint128, denom: string): Coin => ({ amount: String(amount), denom })
/** Convert to fee. */
export const makeFee = (gas: Uint128, amount: Coin[]): Fee => ({ gas: String(gas), amount })
export const makeToken = <T extends Token> (t: T): T & TokenApi => {
  const token: any = { ...t }
  if ('fungible' in token && token.fungible) {
    const amount = (x: Uint128) => makeTokenAmount(x, token as unknown as Fungible)
    const fee    = (x: Uint128) => makeTokenAmount(x, token as unknown as Fungible).asFee(x)
    Object.assign(token, { amount, fee })
  }
  return token as T & TokenApi
}
export const makeTokenAmount = (a: Uint128, t: Fungible): TokenAmount => {
  a = String(a)
  t = makeToken(t)
  return {
    get amount () { return a },
    get token  () { return t },
    get denom  (): string|undefined { return ('denom' in t) ? t.denom as string : undefined },
    get asNativeBalance (): Coin[] { return [this.asCoin] },
    get asCoin (): Coin {
      if ('denom' in t) return makeCoin(a, t.denom as string)
      throw new Error('not a native token')
    },
    asFee (gas: Uint128): Fee {
      if ('denom' in t) return makeFee(gas, this.asNativeBalance)
      throw new Error('not a native token')
    },
    toString () { return `${a} ${t.id}` },
  }
}

export const addZeros = (n: number|Uint128, z: number): Uint128 =>
  `${n}${[...Array(z)].map(() => '0').join('')}`
