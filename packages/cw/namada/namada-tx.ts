import * as Borsher from 'borsher'
import { schemaEnum } from './namada-enum'
import { addressSchema } from './namada-address'
import { u256Schema } from './namada-u256'
const Schema = Borsher.BorshSchema

const hashSchema = Schema.Array(Schema.u8, 32)

const publicKeySchema = schemaEnum([
  ['Ed25519',   Schema.Array(Schema.u8, 32)],
  ['Secp256k1', Schema.Array(Schema.u8, 33)],
])

const headerSchema = Schema.Struct({
  chain_id:                    Schema.String,
  expiration:                  Schema.Option(Schema.String),
  timestamp:                   Schema.String,
  code_hash:                   hashSchema,
  data_hash:                   hashSchema,
  memo_hash:                   hashSchema,
  tx_type:                     schemaEnum([
    ['Raw',                    Schema.Unit],
    ['Wrapper',                Schema.Struct({
      fee:                     Schema.Struct({
        amount_per_gas_unit:   Schema.Struct({
          amount:              u256Schema,
          denomination:        Schema.u8,
        }),
        token:                 addressSchema,
      }),
      pk:                      publicKeySchema,
      epoch:                   Schema.u64,
      gas_limit:               Schema.u64,
      unshield_section_hash:   Schema.Option(hashSchema),
    })],
    ['Decrypted',              schemaEnum([
      ['Decrypted',            Schema.Unit],
      ['Undecryptable',        Schema.Unit],
    ])],
    ['Protocol',               Schema.Struct({
      pk:                      publicKeySchema,
      tx:                      schemaEnum([
        ['EthereumEvents',     Schema.Unit],
        ['BridgePool',         Schema.Unit],
        ['ValidatorSetUpdate', Schema.Unit],
        ['EthEventsVext',      Schema.Unit],
        ['BridgePoolVext',     Schema.Unit],
        ['ValSetUpdateVext',   Schema.Unit],
      ]),
    })],
  ])
})

const codeSchema = Schema.Struct({
  salt:      Schema.Array(Schema.u8, 8),
  code:      schemaEnum([
    ['Hash', hashSchema],
    ['Id',   Schema.Vec(Schema.u8)],
  ]),
  tag:       Schema.Option(Schema.String),
})

const assetTypeSchema = Schema.Struct({
  identifier: Schema.Array(Schema.u8, 32),
  nonce:      Schema.Option(Schema.u8)
})

const txOutSchema = Schema.Struct({
  asset_type: assetTypeSchema,
  value:      Schema.u64,
  address:    Schema.Array(Schema.u8, 20)
})

const bundleSchema = Schema.Struct({
  vin:               Schema.Vec(Schema.Struct({
    asset_type:      assetTypeSchema,
    value:           Schema.u64,
    address:         Schema.Array(Schema.u8, 20),
    transparent_sig: Schema.Unit,
  })),
  vout:              Schema.Vec(txOutSchema),
  authorization:     Schema.Unit
})

const txSchema = Schema.Struct({
  header:                    headerSchema,
  sections:                  Schema.Vec(schemaEnum([
    ['Data',                 Schema.Struct({
      salt:                  Schema.Array(Schema.u8, 8),
      data:                  Schema.Vec(Schema.u8),
    })],
    ['ExtraData',            codeSchema],
    ['Code',                 codeSchema],
    ['Signature',            Schema.Struct({
      targets:               Schema.Vec(hashSchema),
      signer:                schemaEnum([
        ['Address',          addressSchema],
        ['PubKeys',          Schema.Vec(publicKeySchema)],
      ]),
      signatures:            Schema.HashMap(Schema.u8, schemaEnum([
        ['Ed25519',          Schema.Array(Schema.u8, 64)],
        ['Secp256k1',        Schema.Array(Schema.u8, 65)]
      ]))
    })],
    ['Ciphertext',           Schema.Struct({
      opaque:                Schema.Vec(Schema.u8)
    })],
    ['MaspTx',               Schema.Struct({
      txid:                  Schema.Array(Schema.u8, 32),
      data:                  Schema.Struct({
        version:             schemaEnum([
          ['MASPv5',         Schema.Unit]
        ]),
        consensus_branch_id: schemaEnum([
          ['MASP',           Schema.Unit]
        ]),
        lock_time:           Schema.u32,
        expiry_height:       Schema.u32,
        transparent_bundle:  Schema.Option(bundleSchema),
        sapling_bundle:      Schema.Option(bundleSchema),
      }),
    })],
    ['MaspBuilder',          Schema.Struct({
      hash:                  hashSchema,
      asset_types:           Schema.HashSet(Schema.Struct({
        token:               addressSchema,
        denomination:        Schema.u8,
        position:            schemaEnum([
          ['Zero',           Schema.Unit],
          ['One',            Schema.Unit],
          ['Two',            Schema.Unit],
          ['Three',          Schema.Unit],
        ]),
        epoch:               Schema.Option(Schema.u64)
      })),
      metadata:              Schema.Struct({
        spend_indices:       Schema.Vec(Schema.u32),
        convert_indices:     Schema.Vec(Schema.u32),
        output_indices:      Schema.Vec(Schema.u32),
      }),
      builder:               Schema.Struct({
        params:              Schema.Unit,
        rng:                 Schema.Unit,
        target_height:       Schema.u32,
        expiry_height:       Schema.u32,
        transparent_builder: Schema.Struct({
          inputs:            Schema.Vec(Schema.Struct({
            coin:            txOutSchema
          })),
          vout:              Schema.Vec(txOutSchema)
        }),
        sapling_builder:     Schema.Struct({
          params:            Schema.Unit,
          spend_anchor:      Schema.Option(Scalar),
          target_height:     Schema.u32,
          value_balance:     Schema.i128,
          convert_anchor:    Schema.Option(Scalar),
          spends:            Schema.Vec(Schema.Struct({
            extsk:           Key,
            diversifier:     Diversifier,
            node:            Note,
            alpha:           Fr,
            merkle_path:     MerklePath
          })),
          converts:          Schema.Vec(Schema.Struct({
            allowed:         AllowedConversion,
            value:           Schema.u64,
            merkle_path:     MerklePath,
          })),
          outputs:           Schema.Vec(Schema.Struct({
            ovk:             Schema.Option(OutgoingViewingKey),
            to:              PaymentAddress,
            note:            Note,
            memo:            MemoBytes
          })),
        })
      })
    })],
    ['Header',           headerSchema]
  ]))
})

export class NamadaTransaction {
  static fromBorsh = (binary: Uint8Array) => new this(Borsher.borshDeserialize(txSchema, binary))
  header
  sections
  constructor (data: Partial<NamadaTransaction> = {}) {
    console.log(data.header)
    console.log(data.sections)
  }
}
