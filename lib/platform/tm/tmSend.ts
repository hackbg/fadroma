
export const send = (...args: unknown[]) =>
  Error.TODO('tendermint native send')

export const broadcastTx = async (_api: Context, _method: 'sync'|'async'|'commit', _tx: Uint8Array) =>
  Error.TODO('broadcastTx')


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
