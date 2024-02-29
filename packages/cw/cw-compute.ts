import type { CosmWasmClient, SigningCosmWasmClient } from '@hackbg/cosmjs-esm'
import { Deploy } from '@fadroma/agent'
import type { Address, CodeId, Chain, Message, Token } from '@fadroma/agent'
import { Amino } from '@hackbg/cosmjs-esm'

type API = CosmWasmClient|Promise<CosmWasmClient>

export async function getCodes (
  api: API
) {
  api = await Promise.resolve(api)
  const codes: Record<CodeId, Deploy.UploadedCode> = {}
  const results = await api.getCodes()
  for (const { id, checksum, creator } of results||[]) {
    codes[id!] = new Deploy.UploadedCode({
      chainId:  this.chainId,
      codeId:   String(id),
      codeHash: checksum,
      uploadBy: creator
    })
  }
  return codes
}

export async function getCodeId (api: API, address: Address): Promise<CodeId> {
  api = await Promise.resolve(api)
  const { codeId } = await api.getContract(address)
  return String(codeId)
}

export async function getContractsByCodeId (api: API, id: CodeId) {
  api = await Promise.resolve(api)
  const addresses = await api.getContracts(Number(id))
  return addresses.map(address=>({address}))
}

export async function getCodeHashOfAddress (api: API, address: Address) {
  api = await Promise.resolve(api)
  const {codeId} = await api.getContract(address)
  return getCodeHashOfCodeId(api, String(codeId))
}

export async function getCodeHashOfCodeId (api: API, codeId: CodeId) {
  api = await Promise.resolve(api)
  const {checksum} = await api.getCodeDetails(Number(codeId))
  return checksum
}

export async function getLabel (api: API, address: Address) {
  if (!address) {
    throw new Error('chain.getLabel: no address')
  }
  api = await Promise.resolve(api)
  const {label} = await api.getContract(address)
  return label
}

type SigningAPI = SigningCosmWasmClient|Promise<SigningCosmWasmClient>

export async function upload (api: SigningAPI, data: Uint8Array) {
  api = await Promise.resolve(api)
  if (!(api?.upload)) {
    throw new Error("can't upload contract with an unauthenticated agent")
  }
  const result = await api.upload(
    this.address!, data, this.fees?.upload || 'auto', "Uploaded by Fadroma"
  )
  return {
    chainId:   this.chainId,
    codeId:    String(result.codeId),
    codeHash:  result.checksum,
    uploadBy:  this.address,
    uploadTx:  result.transactionHash,
    uploadGas: result.gasUsed
  }
}

export async function instantiate (
  api: SigningAPI,
  codeId: CodeId,
  options: Parameters<Chain.Connection["doInstantiate"]>[1]
) {
  api = await Promise.resolve(api)
  if (!(api?.instantiate)) {
    throw new Error("can't instantiate contract without authorizing the agent")
  }
  const result = await (api as SigningCosmWasmClient).instantiate(
    this.address!,
    Number(codeId),
    options.initMsg,
    options.label!,
    options.initFee as Amino.StdFee || 'auto',
    { admin: this.address, funds: options.initSend, memo: options.initMemo }
  )
  return {
    codeId,
    codeHash: options.codeHash,
    label:    options.label,
    initMsg:  options.initMsg,
    chainId:  this.chainId,
    address:  result.contractAddress,
    initTx:   result.transactionHash,
    initGas:  result.gasUsed,
    initBy:   this.address,
    initFee:  options.initFee || 'auto',
    initSend: options.initSend,
    initMemo: options.initMemo
  }
}

type ExecOptions =
  Omit<NonNullable<Parameters<Chain.Connection["execute"]>[2]>, 'execFee'> & {
    execFee?: Token.IFee | number | 'auto'
  }

export async function execute (
  api: SigningAPI, contract: { address: Address }, message: Message,
  { execSend, execMemo, execFee }: ExecOptions = {}
) {
  api = await Promise.resolve(api)
  if (!(api?.execute)) {
    throw new Error("can't execute transaction without authorizing the agent")
  }
  return api.execute(
    this.address!,
    contract.address,
    message,
    execFee,
    execMemo,
    execSend
  )
}
