import { Core } from '@fadroma/agent'
import * as Borsher from 'borsher'
const Schema = Borsher.BorshSchema

export type Address =
  | { Established: number[] }
  | { Implicit:    number[] }
  | { Internal:    {} }

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
  //console.log(new Uint8Array(Borsher.borshSerialize(addressSchema, address)))
  //const twenty = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
  //for (const key of [
    //'Implicit',                    // 0
    //'Established',                 // 1
    //'Internal_PoS',                // 2
    //'Internal_PosSlashPool',       // 3
    //'Internal_Parameters',         // 4
    //'Internal_Governance',         // 5
    //'Internal_IBC',                // 6
    //'Internal_EthBridge',          // 7
    //'Internal_EthBridgePool',      // 8
    //'Internal_Multitoken',         // 9
    //'Internal_PublicGoodFundings', // 10
    //'Internal_Erc20',              // 11
    //'Internal_Nut',                // 12
    //'Internal_IbcToken',           // 13
    //'Internal_Masp',               // 14
  //]) {
    //const value = { [key]: twenty }
    //const serialized = new Uint8Array(Borsher.borshSerialize(addressSchema, value))
    ////console.log()
    ////console.log(value, '=>', serialized)
  //}
  //console.trace(Core.bech32m.decodeToBytes('tnam1qqr8fld54cckvt2cc2e87z9s7eajm324usq5vkm9'))
  //process.exit(123)
  return Core.bech32m.encode('tnam', Core.bech32m.toWords(Borsher.borshSerialize(addressSchema, address)))
}

export const InternalAddresses = {
  Governance: "tnam1q5qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqrw33g6"
}

const twentyBytes = Schema.Array(Schema.u8, 20)

export const addressSchema = schemaEnum([
  'Implicit',                    // 0
  'Established',                 // 1
  'Internal_PoS',                // 2
  'Internal_PosSlashPool',       // 3
  'Internal_Parameters',         // 4
  'Internal_Governance',         // 5
  'Internal_IBC',                // 6
  'Internal_EthBridge',          // 7
  'Internal_EthBridgePool',      // 8
  'Internal_Multitoken',         // 9
  'Internal_PublicGoodFundings', // 10
  'Internal_Erc20',              // 11
  'Internal_Nut',                // 12
  'Internal_IbcToken',           // 13
  'Internal_Masp',               // 14
].map(variant=>[variant, twentyBytes]))

function schemaEnum (variants: [string, Borsher.BorshSchema][]) {
  return Schema.from({ enum: variants.map(([k, v])=>({ struct: { [k]: v.into() } })) })
}
