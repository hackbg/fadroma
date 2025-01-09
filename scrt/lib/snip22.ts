import type { CosmWasm, Uint128, Address } from '../deps.ts'
export type Snip22Api = {
  batchTransfer (actions: TransferAction[]): Promise<unknown>
  batchTransferFrom (actions: TransferFromAction[]): Promise<unknown>
  batchSend (actions: SendAction[]): Promise<unknown>
  batchSendFrom (actions: SendFromAction[]): Promise<unknown>
}
const batchTransfer = ({ execute }: CosmWasm.Deps, actions: TransferAction[]) =>
  execute({ batch_transfer: { actions } })
const batchTransferFrom = ({ execute }: CosmWasm.Deps, actions: TransferFromAction[]) =>
  execute({ batch_transfer_from: { actions } })
const batchSend = ({ execute }: CosmWasm.Deps, actions: SendAction[]) =>
  execute({ batch_transfer: { actions } })
const batchSendFrom = ({ execute }: CosmWasm.Deps, actions: SendFromAction[]) =>
  execute({ batch_send_from: { actions } })
export const snip22Impl = {
  batchTransfer,
  batchTransferFrom,
  batchSend,
  batchSendFrom,
}

export type TransferAction = {
  recipient: Address
  amount:    Uint128
  memo?:     string
}

export type TransferFromAction = {
  owner:     Address
  recipient: Address
  amount:    Uint128
  memo?:     string
}

export type SendAction = {
  recipient:            Address
  recipient_code_hash?: CosmWasm.CodeHash
  amount:               Uint128
  msg?:                 string
  memo?:                string
}

export type SendFromAction = {
  owner:                Address
  recipient_code_hash?: CosmWasm.CodeHash
  recipient:            Address
  amount:               Uint128
  msg?:                 string
  memo?:                string
}
