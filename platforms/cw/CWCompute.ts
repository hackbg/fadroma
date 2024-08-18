import type { CosmWasmClient, SigningCosmWasmClient } from '@hackbg/cosmjs-esm'
import { Connection, SigningConnection, Agent, UploadedCode, Contract } from '@hackbg/fadroma'
import type { Address, CodeId, Message, Token } from '@hackbg/fadroma'
import { Amino } from '@hackbg/cosmjs-esm'
import type { CWChain, CWConnection } from './CWConnection'
import type { CWAgent, CWSigningConnection } from './CWIdentity'

export async function fetchCodeInfo (
  chain: CWConnection, args: Parameters<Connection["fetchCodeInfoImpl"]>[0]
):
  Promise<Record<CodeId, UploadedCode>>
{
  throw new Error('unimplemented!')
  return {}
    //const { ids = [] } = parameters || {}
    //if (!ids || ids.length === 0) {
      //return getCodes(this)
    //} else if (ids.length === 1) {
      //return getCodes(this, ids)
    //} else {
      //throw new Error('CWConnection.fetchCodeInfo({ ids: [multiple] }): unimplemented!')
    //}
    //protected override fetchCodesImpl () {
      //return getCodes(this)
    //}
    //protected override fetchCodeIdImpl (address: Address): Promise<CodeId> {
      //return getCodeId(this, address)
    //}
    //protected override fetchCodeHashOfCodeIdImpl (codeId: CodeId): Promise<CodeHash> {
      //return getCodeHashOfCodeId(this, codeId)
    //}
}

export async function fetchCodeInstances (
  chain: CWConnection, args: Parameters<Connection["fetchCodeInstancesImpl"]>[0]
):
  Promise<Record<CodeId, Record<Address, Contract>>>
{
  throw new Error('unimplemented!')
  return {}
    //protected override fetchContractsByCodeIdImpl (id: CodeId): Promise<Iterable<{address: Address}>> {
      //return getContractsByCodeId(this, id)
    //}
}

export async function fetchContractInfo (
  chain: CWConnection, args: Parameters<Connection["fetchContractInfoImpl"]>[0]
):
  Promise<{
    [address in keyof typeof args["contracts"]]: InstanceType<typeof args["contracts"][address]>
  }>
{
  throw new Error('unimplemented!')
  return {}
    //return getCodeId(this, address)
    //protected override fetchCodeHashOfAddressImpl (address: Address): Promise<CodeHash> {
      //return getCodeHashOfAddress(this, address)
    //}
    //protected override fetchLabelImpl (address: Address): Promise<string> {
      //return getLabel(this, address)
    //}
}

export async function getCodes (
  chain: CWConnection
) {
  const codes: Record<CodeId, UploadedCode> = {}
  const results = await chain.api.getCodes()
  for (const { id, checksum, creator } of results||[]) {
    codes[id!] = new UploadedCode({
      chainId:  chain.chainId,
      codeId:   String(id),
      codeHash: checksum,
      uploadBy: creator
    })
  }
  return codes
}

export async function getCodeId (
  { api }: Pick<CWConnection, 'api'>, address: Address
): Promise<CodeId> {
  const { codeId } = await api.getContract(address)
  return String(codeId)
}

export async function getContractsByCodeId (
  { api }: Pick<CWConnection, 'api'>, id: CodeId
) {
  const addresses = await api.getContracts(Number(id))
  return addresses.map(address=>({address}))
}

export async function getCodeHashOfAddress (
  { api }: Pick<CWConnection, 'api'>, address: Address
) {
  const {codeId} = await api.getContract(address)
  return getCodeHashOfCodeId({ api }, String(codeId))
}

export async function getCodeHashOfCodeId (
  { api }: Pick<CWConnection, 'api'>, codeId: CodeId
) {
  api = await Promise.resolve(api)
  const {checksum} = await api.getCodeDetails(Number(codeId))
  return checksum
}

export async function getLabel (
  { api }: Pick<CWConnection, 'api'>, address: Address
) {
  if (!address) {
    throw new Error('chain.getLabel: no address')
  }
  const {label} = await api.getContract(address)
  return label
}

export async function query <T> (
  { api }: Pick<CWConnection, 'api'>, options: Parameters<Connection["queryImpl"]>[0]
): Promise<T> {
  api = await Promise.resolve(api)
  if (!options.address) {
    throw new Error('no contract address')
  }
  return await api.queryContractSmart(
    options.address,
    options.message,
  ) as T
}

export async function upload (
  { chainId, address, api }: CWSigningConnection,
  options: Parameters<SigningConnection["uploadImpl"]>[0]
) {
  if (!address) {
    throw new Error("can't upload contract without sender address")
  }
  const result = await api.upload(
    address!,
    options.binary,
    options.uploadFee as Amino.StdFee || 'auto',
    "Uploaded by Fadroma"
  )
  return {
    chainId:   chainId,
    codeId:    String(result.codeId),
    codeHash:  result.checksum,
    uploadBy:  address,
    uploadTx:  result.transactionHash,
    uploadGas: result.gasUsed
  }
}

export async function instantiate (
  { chain, address, api }: CWSigningConnection,
  options: Parameters<SigningConnection["instantiateImpl"]>[0]
) {
  const result = await (api as SigningCosmWasmClient).instantiate(
    address!,
    Number(options.codeId),
    options.initMsg,
    options.label!,
    options.initFee as Amino.StdFee || 'auto',
    { admin: address, funds: options.initSend, memo: options.initMemo }
  )
  return new Contract({
    chain,
    codeId:   options.codeId,
    codeHash: options.codeHash,
    label:    options.label,
    address:  result.contractAddress,
    //initTx:   result.transactionHash,
    //initGas:  result.gasUsed,
    initBy:   address,
    //initFee:  options.initFee || 'auto',
    //initSend: options.initSend,
    //initMemo: options.initMemo
  }) as Contract & { address: Address }
}

export async function execute (
  { address, api }: CWSigningConnection, options: Parameters<SigningConnection["executeImpl"]>[0]
) {
  return api.execute(
    address!,
    options.address,
    options.message,
    options.execFee!,
    options.execMemo,
    options.execSend
  )
}
