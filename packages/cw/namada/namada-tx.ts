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

const txSchema = Schema.Struct({
  header:             headerSchema,
  sections:           Schema.Vec(schemaEnum([
    ['Data',          Schema.Struct({
      salt:           Schema.Array(Schema.u8, 8),
      data:           Schema.Vec(Schema.u8),
    })],
    ['ExtraData',     codeSchema],
    ['Code',          codeSchema],
    ['Signature',     Schema.Struct({
      targets:        Schema.Vec(hashSchema),
      signer:         schemaEnum([
        ['Address',   addressSchema],
        ['PubKeys',   Schema.Vec(publicKeySchema)],
      ]),
      signatures:     Schema.HashMap(Schema.u8, schemaEnum([
        ['Ed25519',   Schema.Array(Schema.u8, 64)],
        ['Secp256k1', Schema.Array(Schema.u8, 65)]
      ]))
    })],
    ['Ciphertext',    Schema.Struct({
      opaque:         Schema.Vec(Schema.u8)
    })],
    ['MaspTx',        Schema.Struct({
      txid:           Schema.Unit, // TODO
      data:           Schema.Unit, // TODO
    })],
    ['MaspBuilder',   Schema.Unit /* TODO */],
    ['Header',        headerSchema]
  ]))
})

export class Transaction {
  static fromBorsh
  header
  sections
}
