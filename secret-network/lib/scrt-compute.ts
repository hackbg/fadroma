import type { TxResponse } from '@hackbg/secretjs-esm'
import { Chain, Agent, Connection, Address, UploadedCode, Contract } from '@hackbg/fadroma'
import type { CodeId, SigningConnection } from '@hackbg/fadroma'
import { bold, withIntoError } from './scrt-base'
import faucets from './scrt-faucets'
import type { ScrtChain, ScrtConnection } from './scrt-chain'
import type { ScrtAgent, ScrtSigningConnection } from './scrt-identity'

export async function fetchCodeInfo (
  { chainId, api }: ScrtConnection,
  args: Parameters<Connection["fetchCodeInfoImpl"]>[0]
):
  Promise<Record<CodeId, UploadedCode>>
{
  const result: Record<CodeId, UploadedCode> = {}
  await withIntoError(api.query.compute.codes({})).then(({code_infos})=>{
    for (const { code_id, code_hash, creator } of code_infos||[]) {
      if (!args?.codeIds || args.codeIds.includes(code_id!)) {
        result[code_id!] = new UploadedCode({
          chainId,
          codeId:   code_id,
          codeHash: code_hash,
          uploadBy: creator
        })
      }
    }
  })
  return result
}

export async function fetchCodeInstances (
  { chainId, api, log }: ScrtConnection,
  args: Parameters<Connection["fetchCodeInstancesImpl"]>[0]
):
  Promise<Record<CodeId, Record<Address, Contract>>>
{
  if (args.parallel) {
    log.warn('fetchCodeInstances in parallel: not implemented')
  }
  const result: Record<CodeId, Record<Address, Contract>> = {}
  for (const [codeId, Contract] of Object.entries(args.codeIds)) {
    let codeHash: string
    const instances = {}
    await withIntoError(api.query.compute.codeHashByCodeId({ code_id: codeId }))
      .then(({code_hash})=>codeHash = code_hash!)
    await withIntoError(api.query.compute.contractsByCodeId({ code_id: codeId }))
      .then(({contract_infos})=>{
        for (const { contract_address, contract_info: { label, creator } } of contract_infos!) {
          result[codeId] ??= {}
          result[codeId][contract_address!] = new Contract({
            chain,
            codeId,
            codeHash,
            label,
            address: contract_address,
            initBy:  creator
          })
        }
      })
    result[codeId] = instances
  }
  return result
}

export async function fetchContractInfo (
  { chainId, api, log }: ScrtConnection,
  args: Parameters<Connection["fetchContractInfoImpl"]>[0]
):
  Promise<{
    [address in keyof typeof args["contracts"]]: InstanceType<typeof args["contracts"][address]>
  }>
{
  if (args.parallel) {
    log.warn('fetchContractInfo in parallel: not implemented')
  }
  throw new Error('unimplemented!')
  //protected override async fetchCodeHashOfAddressImpl (contract_address: Address): Promise<CodeHash> {
    //return (await withIntoError(this.api.query.compute.codeHashByContractAddress({
      //contract_address
    //})))
      //.code_hash!
  //}

  //async getLabel (contract_address: Address): Promise<Chain.Label> {
    //return (await withIntoError(this.api.query.compute.contractInfo({
      //contract_address
    //})))
      //.ContractInfo!.label!
  //}
}

export async function query (
  conn: ScrtConnection,
  args: Parameters<Connection["queryImpl"]>[0]
) {
  const api = await Promise.resolve(conn.api)
  return withIntoError(api.query.compute.queryContract({
    contract_address: args.address,
    code_hash:        args.codeHash,
    query:            args.message as Record<string, unknown>
  }))
}

export async function upload (
  agent: ScrtSigningConnection,
  args: Parameters<SigningConnection["uploadImpl"]>[0]
) {
  const { api, address, fees, log } = agent

  const result = await withIntoError(api.tx.compute.storeCode({
    sender:         address,
    wasm_byte_code: args.binary,
    source:         "",
    builder:        ""
  }, {
    gasLimit:       Number(fees.upload?.amount[0].amount) || undefined
  }))

  const {
    code,
    message,
    details = [],
    rawLog
  } = result as typeof result & { message?: any, details?: any[] }

  if (code !== 0) {
    log.error(
      `Upload failed with code ${bold(code)}:`,
      bold(message ?? rawLog ?? ''),
      ...details
    )
    if (message === `account ${address} not found`) {
      log.info(`If this is a new account, send it some SCRT first.`)
      const chainId = agent.chain.chainId
      if (faucets[chainId]) {
        log.info(`Available faucets\n `, [...faucets[chainId]].join('\n  '))
      }
    }
    log.error(`Upload failed`, { result })
    throw new Error('upload failed')
  }

  type Log = { type: string, key: string }

  const codeId = result.arrayLog
    ?.find((log: Log) => log.type === "message" && log.key === "code_id")
    ?.value
  if (!codeId) {
    log.error(`Code ID not found in result`, { result })
    throw new Error('upload failed')
  }
  const { codeHash } = await agent.chain.fetchCodeInfo(codeId)
  return new UploadedCode({
    chainId:   agent.chain.chainId,
    codeId,
    codeHash,
    uploadBy:  address,
    uploadTx:  result.transactionHash,
    uploadGas: result.gasUsed
  })
}

export async function instantiate (
  conn: ScrtSigningConnection,
  args: Parameters<SigningConnection["instantiateImpl"]>[0]
) {
  const { chain, api, address, log, fees } = conn
  const parameters = {
    sender:     conn.address,
    code_id:    Number(args.codeId),
    code_hash:  args.codeHash,
    label:      args.label!,
    init_msg:   args.initMsg,
    init_funds: args.initSend,
    memo:       args.initMemo
  }
  const instantiateOptions = {
    gasLimit: Number(fees.init?.amount[0].amount) || undefined
  }
  const result = await withIntoError(
    api.tx.compute.instantiateContract(parameters, instantiateOptions)
  )

  if (result.code !== 0) {
    log.error('Init failed:', {
      parameters,
      instantiateOptions,
      result
    })
    throw new Error(`init of code id ${args.codeId} failed`)
  }

  return new Contract({
    chain,
    address:  result.arrayLog!.find(
      ({ type, key }: { type: string, key: string }) =>
        type === "message" && key === "contract_address"
    )?.value!,
    codeHash: args.codeHash,
    initBy:   address,
    initTx:   result.transactionHash,
    initGas:  result.gasUsed,
    label:    args.label,
  }) as Contract & { address: Address }
}

export async function execute (
  conn: ScrtSigningConnection,
  args: Parameters<SigningConnection["executeImpl"]>[0] & { preSimulate?: boolean }
) {
  const { api, log, address } = conn

  const tx = {
    sender:           conn.address!,
    contract_address: args.address,
    code_hash:        args.codeHash,
    msg:              args.message as Record<string, unknown>,
    sentFunds:        args?.execSend
  }

  const txOpts = {
    gasLimit: Number(args?.execFee?.gas) || undefined
  }

  if (args?.preSimulate) {
    log.info('Simulating transaction...')
    let simResult
    try {
      simResult = await api.tx.compute.executeContract.simulate(tx, txOpts)
    } catch (e) {
      log.error(e)
      log.warn('TX simulation failed:', tx, 'from', address)
    }
    const gas_used = simResult?.gas_info?.gas_used
    if (gas_used) {
      log.info('Simulation used gas:', gas_used)
      const gas = Math.ceil(Number(gas_used) * 1.1)
      // Adjust gasLimit up by 10% to account for gas estimation error
      log.info('Setting gas to 110% of that:', gas)
      txOpts.gasLimit = gas
    }
  }

  const result = await api.tx.compute.executeContract(tx, txOpts)

  // check error code as per https://grpc.github.io/grpc/core/md_doc_statuscodes.html
  if (result.code !== 0) {
    throw decodeError(result)
  }

  return result as TxResponse
}

export function decodeError (result: TxResponse) {
  const error = `ScrtConnection#execute: gRPC error ${result.code}: ${result.rawLog}`
  // make the original result available on request
  const original = structuredClone(result)
  Object.defineProperty(result, "original", {
    enumerable: false, get () { return original }
  })
  // decode the values in the result
  const txBytes = tryDecode(result.tx as Uint8Array)
  Object.assign(result, { txBytes })
  for (const i in result.tx.signatures) {
    Object.assign(result.tx.signatures, { [i]: tryDecode(result.tx.signatures[i as any]) })
  }
  for (const event of result.events) {
    for (const attr of event?.attributes ?? []) {
      //@ts-ignore
      try { attr.key   = tryDecode(attr.key)   } catch (e) {}
      //@ts-ignore
      try { attr.value = tryDecode(attr.value) } catch (e) {}
    }
  }
  return Object.assign(new Error(error), result)
}

/** Used to decode Uint8Array-represented UTF8 strings in TX responses. */
const decoder = new TextDecoder('utf-8', { fatal: true })

/** Marks a response field as non-UTF8 to prevent large binary arrays filling the console. */
export const nonUtf8 = Symbol('(binary data, see result.original for the raw Uint8Array)')

/** Decode binary response data or mark it as non-UTF8 */
const tryDecode = (data: Uint8Array): string|Symbol => {
  try {
    return decoder.decode(data)
  } catch (e) {
    return nonUtf8
  }
}
