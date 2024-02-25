import * as BorshJS from 'borsh'
import * as Borsher from 'borsher'
import type { Address } from '@fadroma/agent'
import { addressSchema, InternalAddresses } from './namada-address'
import { BinaryReader, BinaryWriter, field, vec } from "@dao-xyz/borsh";
import BigNumber from "bignumber.js";
import { Core } from '@fadroma/agent'

type Connection = { abciQuery: (path: string)=>Promise<Uint8Array> }

const Schema = Borsher.BorshSchema

export async function getValidatorMetadata (connection: Connection, address: Address) {
  //const status = await connection.abciQuery(`/status`)
  //console.log({status})
  const [
    metadata,
    /*commission,*/
    state,
  ] = await Promise.all([
    `/vp/pos/validator/metadata/${address}`,
    //`/vp/pos/validator/commission/${address}`, // TODO
    `/vp/pos/validator/state/${address}`,
  ].map(path => connection.abciQuery(path)))
  return {
    metadata: BorshJS.deserialize(
      {
        option: {
          struct: {
            email:          'string',
            description:    { option: 'string' },
            website:        { option: 'string' },
            discord_handle: { option: 'string' },
            avatar:         { option: 'string' }
          }
        }
      },
      metadata
    ) as ValidatorMetaData,
    //state: BorshJS.deserialize(
      //{
        //enum: [
          //{struct:{consensus:{}}},
          //{struct:{below_capacity:{}}},
          //{struct:{below_threshold:{}}},
          //{struct:{inactive:{}}},
          //{struct:{jailed:{}}},
        //]
      //},
      //state
    //) as any
    //commission: Borsh.deserialize(Borshes.CommissionPair, commission),
  }
}

export type ValidatorMetaData = {
  email:          string
  description:    string|null
  website:        string|null
  discord_handle: string|null
  avatar:         string|null
}

export const BigNumberSerializer = {
  serialize (value: BigNumber, writer: BinaryWriter) {
    writer.string(value.toString())
  },
  deserialize (reader: BinaryReader): BigNumber {
    return new BigNumber(reader.string())
  }
}
