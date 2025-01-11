import {
  Address,
  ChainId,
  ChainRef,
  CodeHash,
  CodeId,
  Coin,
  Hash,
  Label,
  Message,
  MsgExecuteContract,
  MsgInstantiateContract,
  MsgStoreCode,
  SecretNetworkClient,
  Tendermint,
  bold
} from '../deps.ts'
import type { Console, Agent } from './scrt.ts'
export type Batch = Tendermint.Batch & {
  /** Messages to encrypt. */
  messages: Array<BatchMessage>
}
export type BatchMessage =
  |InstanceType<typeof MsgStoreCode>
  |InstanceType<typeof MsgInstantiateContract>
  |InstanceType<typeof MsgExecuteContract>
export type BatchContext = Batch & {
  log:   Console,
  agent: Agent,
  chain: () => ChainRef
  api?:  SecretNetworkClient,
  fees?: Tendermint.FeeMap<'upload'|'init'|'exec'|'send'>
}
export type BatchResult = {
  sender?:   Address
  tx:        Hash
  type:      'wasm/MsgInstantiateContract'|'wasm/MsgExecuteContract'
  chainId:   ChainId
  codeId?:   CodeId
  codeHash?: CodeHash
  address?:  Address
  label?:    Label
}
export const batch = (agent: Agent, api?: SecretNetworkClient): BatchContext => {
  const batch: BatchContext = {
    log:   agent.log,
    chain: agent.chain,
    agent,
    api,
    messages: [],
    add: (): Batch & BatchContext => batch,
    submit: (_agent: Agent) => { throw new Error('todo') },
  }
  return batch
}
/** TODO: Upload in batch. */
export const uploadInBatch = (_deps: BatchContext, _code: never, _options: never) => {
  throw new Error('Batch#upload: not implemented')
  return this
}
export const instantiateInBatch = (
  { agent, messages }: BatchContext,
  code: CodeId,
  options: { label: Label, initMsg: Message, initSend: Coin[] },
) => {
  messages.push(new MsgInstantiateContract({
    //callback_code_hash: '',
    //callback_sig:       null,
    sender:     agent!.address!,
    code_id:    code,
    label:      options.label!,
    init_msg:   options.initMsg,
    init_funds: options.initSend,
  }))
  return this
}
export const executeInBatch = (
  { agent, messages }: BatchContext,
  contract: Address|{ address: Address },
  message:  Message,
  options:  { execSend: Coin[] },
) => {
  if (typeof contract === 'object') contract = contract.address!
  messages.push(new MsgExecuteContract({
    //callback_code_hash: '',
    //callback_sig:       null,
    sender:           agent!.address!,
    contract_address: contract,
    sent_funds:       options?.execSend,
    msg:              message as object,
  }))
  return this
}
/** Format the messages for API v1 like secretjs and encrypt them. */
export const encryptBatch = ({ agent, messages = [] }: BatchContext): Promise<any[]> =>
  Promise.all(messages.map((message: object) => {
    switch (true) {
      case (message instanceof MsgStoreCode):           return encryptUpload(message)
      case (message instanceof MsgInstantiateContract): return encryptInit(agent, message as any)
      case (message instanceof MsgExecuteContract):     return encryptExec(agent, message as any)
      default: throw new Error(`unsupported batch message: ${message}`)
    }
  }))
export const encryptUpload = async (upload: any): Promise<any> =>
  { throw new Error('not implemented') }
export const encryptInit = async (agent: Agent, init: {
  codeId:   CodeId,
  codeHash: CodeHash,
  label:    Label
  msg:      Message,
  funds:    Coin[],
}) => ({
  "@type":      "/secret.compute.v1beta1.MsgInstantiateContract",
  sender:       agent.address,
  code_id:      String(init.codeId),
  init_funds:   init.funds,
  label:        init.label,
  init_msg:     await agent.encrypt(init.codeHash, init.msg),
  callback_sig: null,
  callback_code_hash: '',
})
export const encryptExec = async (agent: Agent, exec: {
  sender:   Address,
  contract: Address,
  codeHash: CodeHash,
  msg:      Message,
  funds:    Coin[]
}) => ({
  "@type":      '/secret.compute.v1beta1.MsgExecuteContract',
  sender:       agent.address,
  contract:     exec.contract,
  sent_funds:   exec.funds,
  msg:          await agent.encrypt(exec.codeHash, exec.msg),
  callback_sig: null,
  callback_code_hash: '',
})
const simulateBatch = ({ api, messages }: BatchContext) =>
  Promise.resolve(api).then(api=>api!.tx.simulate(messages))
const submitBatch = async ({ chain, api, fees, messages, agent, log }: BatchContext, { memo = "" }: { memo: string }): Promise<BatchResult[]> => {
  //const api = await Promise.resolve(batch.chain!.api)
  const chainId  = chain().id
  const limit    = Number(fees?.exec?.amount[0].amount) || undefined
  const gas      = messages.length * (limit || 0)
  const results: BatchResult[] = []
  try {
    const txResult = await api!.tx.broadcast(messages as any, { gasLimit: gas })
    if (txResult.code !== 0) {
      const error = `(in batch): gRPC error ${txResult.code}: ${txResult.rawLog}`
      throw Object.assign(new Error(error), txResult)
    }
    for (const i in messages) {
      const msg    = messages[i]
      const sender = agent.address
      const tx     = txResult.transactionHash
      const result: Partial<BatchResult> = { chainId, sender, tx, }
      if (msg instanceof MsgInstantiateContract) {
        const findAddr = ({msg, type, key}: { msg: number, type: string, key: string }) =>
          msg  ==  Number(i) &&
          type === "message" &&
          key  === "contract_address"
        results[Number(i)] = Object.assign(result, {
          type:    'wasm/MsgInstantiateContract',
          codeId:  msg.codeId,
          label:   msg.label,
          address: txResult.arrayLog?.find(findAddr)?.value,
        }) as BatchResult
      } else if (msg instanceof MsgExecuteContract) {
        results[Number(i)] = Object.assign(result, {
          type:    'wasm/MsgExecuteContract',
          address: msg.contractAddress
        }) as BatchResult
      }
    }
  } catch (error: any) {
    log.br()
      .error('submitting batch failed:')
      .error(bold(error.message))
      .warn('(decrypting batch errors is not implemented)')
    throw error
  }
  return results
}
/** Format the messages for API v1beta1 like secretcli and generate a multisig-ready
  * unsigned transaction batch; don't execute it, but save it in
  * `state/$CHAIN_ID/transactions` and output a signing command for it to the console. */
const saveBatch = async ({ log, agent, chain, messages: encryptedMessages }: BatchContext, name?: string) => {
  // Number of batch, just for identification in console
  name ??= name || `TX.${+new Date()}`
  // Get signer's account number and sequence via the canonical API
  const { accountNumber, sequence } = await agent!.getNonce()//chain.url, chain!.address)
  // Print the body of the batch
  log.debug(`Messages in batch:`)
  for (const msg of encryptedMessages??[]) {
    log.debug(' ', JSON.stringify(msg))
  }
  // The base Batch class stores messages as (immediately resolved) promises
  const messages = await encryptedMessages
  // Print the body of the batch
  log.debug(`Encrypted messages in batch:`)
  for (const msg of messages??[]) {
    log.info(' ', JSON.stringify(msg))
  }
  // Compose the plaintext
  const unsigned = composeUnsignedTx(messages, name)
  // Output signing instructions to the console
  const output = `${name}.signed.json`
  const string = JSON.stringify(unsigned)
  const txdata = shellescape([string])

  log
    .br()
    .info('Multisig batch ready.')
    .info(`Run the following command to sign the batch:
\nsecretcli tx sign /dev/stdin --output-document=${output} \\
--offline --from=YOUR_MULTISIG_MEMBER_ACCOUNT_NAME_HERE --multisig=${agent!.address} \\
--chain-id=${chain().id} --account-number=${accountNumber} --sequence=${sequence} \\
<<< ${txdata}`)
    .br()
    .debug(`Batch contents:`, JSON.stringify(unsigned, null, 2))
    .br()

  return {
    name,
    accountNumber,
    sequence,
    unsignedTxBody: JSON.stringify(unsigned)
  }
}
const composeUnsignedTx = (encryptedMessages: any[], memo?: string): any => {
  const gas = 10000000
  const fee = { amount: [Tendermint.makeCoin(gas, 'uscrt')], gas: 10000000 }
  const auth_info = { signer_infos: [], fee: { ...fee, gas: fee.gas, payer: "", granter: "" }, }
  const body = { memo, messages: encryptedMessages, timeout_height: "0", extension_options: [], non_critical_extension_options: [] }
  return { auth_info, signatures: [], body }
}
const shellescape = (a: string[]) => {
  const ret: string[] = [];
  for (let s of a) {
    if (/[^A-Za-z0-9_\/:=-]/.test(s)) {
      s = "'"+s.replace(/'/g,"'\\''")+"'"
      s = s.replace(/^(?:'')+/g, '') // unduplicate single-quote at the beginning
        .replace(/\\'''/g, "\\'" ) // remove non-escaped single-quote if there are enclosed between 2 escaped
    }
    ret.push(s)
  }
  return ret.join(' ')
}
