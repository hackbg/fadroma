import { Core } from '@fadroma/agent'
import * as Borsher from 'borsher'
const Schema = Borsher.BorshSchema

export type Address =
  | { Established: number[] }
  | { Implicit:    number[] }
  | { Internal:    number[] }

export function decodeAddressFields <T> (object: T, fields: (keyof T)[]) {
  for (const field of fields) {
    if (typeof object[field] === 'object') {
      (object[field] as string) = toBech32(object[field] as Address)
    }
  }
}

export const toBech32 = (address: Address) => {
  if (Object.keys(address).length !== 1) {
    throw new Core.Error("address variant must have exactly 1 key")
  }
  const { Established, Implicit, Internal } = address as any
  if (Established) {
    return Core.bech32.encode('tnam', Core.bech32.toWords(new Uint8Array(Established)))
  }
  if (Implicit) {
    return Core.bech32.encode('tnam', Core.bech32.toWords(new Uint8Array(Implicit)))
  }
  if (Internal) {
    return Core.bech32.encode('tnam', Core.bech32.toWords(new Uint8Array(Internal)))
  }
  throw new Core.Error("address variant must be one of: Established, Implicit, Internal")
}

export const InternalAddresses = {
  Governance: "tnam1q5qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqrw33g6"
}

export const addressSchema = Schema.Enum({
  Established:     Schema.Array(Schema.u8, 20),
  Implicit:        Schema.Array(Schema.u8, 20),
  Internal:        Schema.Enum({
    PoS:           Schema.Unit,
    PosSlashPool:  Schema.Unit,
    Parameters:    Schema.Unit,
    Ibc:           Schema.Unit,
    IbcToken:      Schema.Array(Schema.u8, 20),
    Governance:    Schema.Unit,
    EthBridge:     Schema.Unit,
    EthBridgePool: Schema.Unit,
    Erc20:         Schema.Array(Schema.u8, 20),
    Nut:           Schema.Array(Schema.u8, 20),
    Multitoken:    Schema.Unit,
    Pgf:           Schema.Unit,
    Masp:          Schema.Unit,
  }),
})
