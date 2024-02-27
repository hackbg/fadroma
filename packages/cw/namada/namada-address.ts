import { Core } from '@fadroma/agent'
import * as Borsher from 'borsher'
import { schemaEnum } from './namada-enum'

const Schema = Borsher.BorshSchema

export const InternalAddresses = {
  Governance: "tnam1q5qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqrw33g6"
}

const console = new Core.Console()

console
  .warn('Namada addresses are returned in uncertain form by the node.')
  .warn('See https://github.com/anoma/namada/issues/2731 for details.')

export type Address =
  | { Established: number[] }
  | { Implicit:    number[] }
  | { Internal:    {} }

export const addressSchema = Schema.Array(Schema.u8, 21)

const twentyBytesSchema = Schema.Array(Schema.u8, 20)

const rawAddressSchema = schemaEnum([
  'Implicit',                    // 0 // FIXME: switched around
  'Established',                 // 1 // FIXME: switched around
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
].map(variant=>[variant, twentyBytesSchema]))

export const decodeAddress = (address: number[]|Uint8Array) => {
  if (!(
    ((address instanceof Array) || (address instanceof Uint8Array))
    && (address.length === 21)
  )) {
    throw new Core.Error("address must be array of 21 bytes")
  }
  address = [...address]
  if (address[0] === 0) {
    address[0] = 1
    console.warn('Fixing discriminant 0 to 1 in address')
  } else if (address[0] === 1) {
    address[0] = 0
    console.warn('Fixing discriminant 1 to 0 in address')
  }
  return Core.bech32m.encode('tnam', Core.bech32m.toWords(new Uint8Array([...address])))
}

//export const decodeAddress = (address: Address) => {
  //if (Object.keys(address).length !== 1) {
    //throw new Core.Error("address variant must have exactly 1 key")
  //}
  //return Core.bech32m.encode('tnam', Core.bech32m.toWords(Borsher.borshSerialize(addressSchema, address)))
//}

export function decodeAddressFields <T> (object: T, fields: (keyof T)[]) {
  for (const field of fields) {
    if ((object[field] instanceof Array) || (object[field] instanceof Uint8Array)) {
      (object[field] as string) = decodeAddress(object[field] as Array<number>)
    }
    //if (typeof object[field] === 'object') {
      //(object[field] as string) = decodeAddress(object[field] as Address)
    //}
  }
}

//export const decodeAddress = (address: Address) => {
  //if (Object.keys(address).length !== 1) {
    //throw new Core.Error("address variant must have exactly 1 key")
  //}
  //return Core.bech32m.encode('tnam', Core.bech32m.toWords(Borsher.borshSerialize(addressSchema, address)))
//}


//export const addressSchema = schemaEnum([
  //'Implicit',                    // 0 // FIXME: switched around
  //'Established',                 // 1 // FIXME: switched around
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
//].map(variant=>[variant, twentyBytes]))
