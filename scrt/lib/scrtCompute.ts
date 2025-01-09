import { Address, CosmWasm, bold } from '../deps.ts'
import type { TxResponse } from '../deps.ts'
import type { Deps, AgentDeps, Connection } from './scrt.ts'
import faucets from './scrtFaucet.ts'
export const fetchCodeInfo = async (
  { chain, api, withIntoError }: Deps, ...args: Parameters<CosmWasm.Api["fetchCodeInfo"]>
): Promise<Record<CosmWasm.CodeId, CosmWasm.UploadedCode>> => {
  const result: Record<CosmWasm.CodeId, CosmWasm.UploadedCode> = {}
  await withIntoError(api.query.compute.codes({})).then(({code_infos})=>{
    for (const { code_id, code_hash, creator } of code_infos||[]) {
      if (!args[0] || args[0].includes(code_id!)) {
        result[code_id!] = new UploadedCode({
          chainId:  chain().id,
          codeId:   code_id,
          codeHash: code_hash,
          uploadBy: creator
        })
      }
    }
  })
  return result
}
export const fetchCodeInstances = async (
  { chain, api, log, withIntoError }: Deps, ...args: Parameters<CosmWasm.Api["fetchCodeInstances"]>
): Promise<Record<CosmWasm.CodeId, Record<Address, CosmWasm.Contract>>> => {
  if (args[2]?.parallel) log.warn('fetchCodeInstances in parallel: not implemented')
  const result: Record<CosmWasm.CodeId, Record<Address, CosmWasm.Contract>> = {}
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
export const fetchContractInfo = async (
  { chain, api, log, withIntoError }: Deps, ...args: Parameters<CosmWasm.Api["fetchContractInfo"]>
): Promise<{
  [address in keyof typeof args["contracts"]]: InstanceType<typeof args["contracts"][address]>
}> => {
  if (args.parallel) log.warn('fetchContractInfo in parallel: not implemented')
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
export const query = async (deps: Deps, args: Parameters<Connection["queryImpl"]>[0]) => {
  const { withIntoError } = deps
  const api = await Promise.resolve(deps.api)
  return withIntoError(api.query.compute.queryContract({
    contract_address: args.address,
    code_hash:        args.codeHash,
    query:            args.message as Record<string, unknown>
  }))
}
export const upload = async (deps: AgentDeps, ...args: Parameters<CosmWasm.Api["upload"]>) => {
  const { chain, api, address, fees, log, withIntoError } = deps
  const gasLimit = Number(fees.upload?.amount[0].amount) || undefined
  const result = await withIntoError(api.tx.compute.storeCode({
    sender:         address,
    wasm_byte_code: args[0].binary,
    source:         "",
    builder:        ""
  }, { gasLimit }))
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
      const chainId = chain().id
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
  const { codeHash } = await fetchCodeInfo(deps, codeId)
  return new CosmWasm.UploadedCode({
    chainId:   chain().id,
    codeId,
    codeHash,
    uploadBy:  address,
    uploadTx:  result.transactionHash,
    uploadGas: result.gasUsed
  })
}
export const instantiate = async (
  { chain, api, address, log, fees, withIntoError }: AgentDeps, ...args: Parameters<CosmWasm.Api["instantiate"]>
) => {
  const parameters = {
    sender:     address,
    code_id:    Number(args[0].codeId),
    code_hash:  args[0].codeHash,
    label:      args[0].label!,
    init_msg:   args[0].initMsg,
    init_funds: args[0].initSend,
    memo:       args[0].initMemo
  }
  const instantiateOptions = {
    gasLimit: Number(fees.init?.amount[0].amount) || undefined
  }
  const result = await withIntoError(
    api.tx.compute.instantiateContract(parameters, instantiateOptions)
  )
  if (result.code !== 0) {
    log.error('Init failed:', { parameters, instantiateOptions, result })
    throw new Error(`init of code id ${args[0].codeId} failed`)
  }
  return new Contract({
    chain,
    address:  result.arrayLog!.find(
      ({ type, key }: { type: string, key: string }) =>
        type === "message" && key === "contract_address"
    )?.value!,
    codeHash: args[0].codeHash,
    initBy:   address,
    initTx:   result.transactionHash,
    initGas:  result.gasUsed,
    label:    args[0].label,
  }) as Contract & { address: Address }
}
export const execute = async (
  { api, log, address }: AgentDeps, ...args: Parameters<CosmWasm.Api["execute"]>
) => {
  const tx = {
    sender:           address!,
    contract_address: args[0].address,
    code_hash:        args[0].codeHash,
    msg:              args[0].message as Record<string, unknown>,
    sentFunds:        args[0]?.execSend
  }
  const txOpts = {
    gasLimit: Number(args[0]?.execFee?.gas) || undefined
  }
  if (args[0]?.preSimulate) {
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
export const decodeError = (result: TxResponse) => {
  const error = `scrt execute: gRPC error ${result.code}: ${result.rawLog}`
  // make the original result available on request
  const original = structuredClone(result)
  Object.defineProperty(result, "original", {
    enumerable: false, get () { return original }
  })
  // decode the values in the result
  const txBytes = tryDecode(result.tx as Uint8Array)
  Object.assign(result, { txBytes })
  for (const i in result.tx.signatures) {
    Object.assign(result.tx.signatures, { [i]: tryDecode(result.tx.signatures[i]) })
  }
  for (const event of result.events) {
    for (const attr of event?.attributes ?? []) {
      try { attr.key   = tryDecode(attr.key)   } catch (_e) { /* */ }
      try { attr.value = tryDecode(attr.value) } catch (_e) { /* */ }
    }
  }
  return Object.assign(new Error(error), result)
}
/** Used to decode Uint8Array-represented UTF8 strings in TX responses. */
const decoder = new TextDecoder('utf-8', { fatal: true })
/** Marks a response field as non-UTF8 to prevent large binary arrays filling the console. */
export const nonUtf8 = Symbol('(binary data, see result.original for the raw Uint8Array)')
/** Decode binary response data or mark it as non-UTF8 */
const tryDecode = (data: Uint8Array): string|symbol => {
  try {
    return decoder.decode(data)
  } catch (_e) {
    return nonUtf8
  }
}
