import type { CosmWasm, Uint128, Address } from '../deps.ts'
export type Snip22Api = {
  batchTransfer (actions: TransferAction[]): Promise<unknown>
  batchTransferFrom (actions: TransferFromAction[]): Promise<unknown>
  batchSend (actions: SendAction[]): Promise<unknown>
  batchSendFrom (actions: SendFromAction[]): Promise<unknown>
}
const batchTransfer = ({ execSelf }: CosmWasm.ClientApi, actions: TransferAction[]) =>
  execSelf({ batch_transfer: { actions } })
const batchTransferFrom = ({ execSelf }: CosmWasm.ClientApi, actions: TransferFromAction[]) =>
  execSelf({ batch_transfer_from: { actions } })
const batchSend = ({ execSelf }: CosmWasm.ClientApi, actions: SendAction[]) =>
  execSelf({ batch_transfer: { actions } })
const batchSendFrom = ({ execSelf }: CosmWasm.ClientApi, actions: SendFromAction[]) =>
  execSelf({ batch_send_from: { actions } })
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
