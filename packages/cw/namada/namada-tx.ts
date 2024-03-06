import * as Borsher from 'borsher'
import { schemaEnum } from './namada-enum'
import { addressSchema } from './namada-address'
const Schema = Borsher.BorshSchema

const hashSchema = Schema.Array(Schema.u8, 32)

const headerSchema = Schema.Struct({
  chain_id:       Schema.String,
  expiration:     Schema.Option(Schema.String),
  timestamp:      Schema.String,
  code_hash:      hashSchema,
  data_hash:      hashSchema,
  memo_hash:      hashSchema,
  tx_type:        schemaEnum([
    ['Raw',       Schema.Unit],
    ['Wrapper',   {}],
    ['Decrypted', {}],
    ['Protocol',  {}],
  ])
})

const commitmentSchema = schemaEnum([
  ['Hash', hashSchema],
  ['Id',   Schema.Vec(Schema.u8)],
])

const codeSchema = Schema.Struct({
  salt: Schema.Array(Schema.u8, 8),
  code: commitmentSchema,
  tag:  Schema.Option(Schema.String),
})

const sectionSchema = schemaEnum([
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
  ['MaspTx',        maspTxSchema],
  ['MaspBuilder',   maspBuilderSchema],
  ['Header',        headerSchema]
])

const txSchema = Schema.Struct({
  header:   headerSchema,
  sections: Schema.Vec(sectionSchema)
})

export class Transaction {
  static fromBorsh
  header
  sections
}
