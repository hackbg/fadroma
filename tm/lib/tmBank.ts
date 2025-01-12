import { Error } from './tmLog.ts'
import type { Address, Uint128 } from '../deps.ts'
import type { Fee } from './tmToken.ts'

export type BankApi = {
  fetchBalance: FetchBalance
  send:         Send
}
export type FetchBalance =
  & ((address: Address, token: string) => Promise<Uint128>)
  & ((address: Address, tokens?: string[]) => Promise<Record<string, Uint128>>)
  & ((addresses: Address[], token: string) => Promise<Record<Address, Uint128>>)
  & ((addresses: Address[], tokens?: string) => Promise<Record<Address, Record<string, Uint128>>>)
export const fetchBalance = (...args: unknown[]) =>
  Error.TODO('tendermint fetch native balance')
export type Send =
  & ((outputs: Record<Address, Record<string, Uint128>>, options?: SendOptions)=>Promise<unknown>)
export type SendOptions = {
  outputs:   Record<Address, Record<string, Uint128>>,
  sendFee?:  Fee,
  sendMemo?: string,
  parallel?: boolean
}
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
