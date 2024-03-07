import * as Borsher from 'borsher'
import { schemaEnum, enumVariant } from './namada-enum'
import { addressSchema } from './namada-address'
import { u256Schema } from './namada-u256'
import { Core } from '@fadroma/agent'
const Schema = Borsher.BorshSchema

export class NamadaTransaction {
  chainId!:    string
  expiration!: string|null
  timestamp!:  string
  codeHash!:   string
  dataHash!:   string
  memoHash!:   string
  txType!:     'Raw'|'Wrapper'|'Decrypted'|'Protocol'
  sections!:   object[]
  constructor (header: object, sections: object[]) {
    const fields = Object.keys(headerFields).filter(key=>key!=='tx_type')
    Core.assignCamelCase(this, header, Object.keys(headerFields))
    for (const field of ['codeHash', 'dataHash', 'memoHash']) {
      if (this[field] instanceof Uint8Array) {
        this[field] = Core.base16.encode(this[field])
      } else if (this[field] instanceof Array) {
        this[field] = Core.base16.encode(new Uint8Array(this[field]))
      }
    }
    this.sections = sections
  }
  static fromBorsh = (binary: Uint8Array) => {
    const { header: { tx_type, ...header }, sections } =
      Borsher.borshDeserialize(txSchema, binary) as any
    const [txType, details] = enumVariant(tx_type)
    switch (txType) {
      case 'Raw':
        return new NamadaRawTransaction(header, details, sections)
      case 'Wrapper':
        return new NamadaWrapperTransaction(header, details, sections)
      case 'Decrypted':
        return new NamadaDecryptedTransaction(header, details, sections)
      case 'Protocol':
        return new NamadaProtocolTransaction(header, details, sections)
    }
    throw new Error(
      `Unknown transaction variant "${String(txType)}". Valid are: Raw|Wrapper|Decrypted|Protocol`
    )
  }
  print (console = new Core.Console()) {
    console
      .log('TX type:   ', Core.bold(this.txType))
      .log('Chain ID:  ', Core.bold(this.chainId))
      .log('Timestamp: ', Core.bold(this.timestamp))
      .log('Expiration:', Core.bold(this.expiration))
      .log('Code hash: ', Core.bold(this.codeHash))
      .log('Data hash: ', Core.bold(this.dataHash))
      .log('Memo hash: ', Core.bold(this.memoHash))
      .log('Sections:  ', this.sections)
  }
}

export class NamadaRawTransaction extends NamadaTransaction {
  txType = 'Raw' as 'Raw'
  constructor (header: object, details: object, sections: object[]) {
    super(header, sections)
    this.txType = 'Raw'
  }
}

export class NamadaWrapperTransaction extends NamadaTransaction {
  txType = 'Wrapper' as 'Wrapper'
  fee:                 {
    token:             string
    amountPerGasUnit:  {
      amount:          bigint,
      denomination:    number
    },
  }
  pk:                  string
  epoch:               bigint
  gasLimit:            bigint
  unshieldSectionHash: string|null
  constructor (header: object, details: object, sections: object[]) {
    super(header, sections)
    Core.assignCamelCase(this, details, Object.keys(wrapperTransactionFields))
    this.txType = 'Wrapper'
  }
}

export class NamadaDecryptedTransaction extends NamadaTransaction {
  txType = 'Decrypted' as 'Decrypted'
  undecryptable: boolean
  constructor (header: object, details: object, sections: object[]) {
    super(header, sections)
    this.txType = 'Decrypted'
    const [variant, _] = enumVariant(details)
    switch (variant) {
      case 'Decrypted':
        this.undecryptable = false
        break
      case 'Undecryptable':
        this.undecryptable = true
        break
      default:
        throw new Error(
          `Invalid decrypted transaction details. Allowed: {"Decrypted":{}}|{"Undecryptable":{}}`
        )
    }
  }
}

export class NamadaProtocolTransaction extends NamadaTransaction {
  txType = 'Protocol' as 'Protocol'
  pk: string
  tx: |'EthereumEvents'
      |'BridgePool'
      |'ValidatorSetUpdate'
      |'EthEventsVext'
      |'BridgePoolVext'
      |'ValSetUpdateVext'
  constructor (header: object, details: object, sections: object[]) {
    super(header, sections)
    Core.assignCamelCase(this, details, Object.keys(protocolTransactionFields))
    this.txType = 'Protocol'
  }
}

const hashSchema = Schema.Array(Schema.u8, 32)

const publicKeySchema = schemaEnum([
  ['Ed25519',   Schema.Array(Schema.u8, 32)],
  ['Secp256k1', Schema.Array(Schema.u8, 33)],
])

const wrapperTransactionFields = {
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
}

const protocolTransactionFields = {
  pk:                      publicKeySchema,
  tx:                      schemaEnum([
    ['EthereumEvents',     Schema.Unit],
    ['BridgePool',         Schema.Unit],
    ['ValidatorSetUpdate', Schema.Unit],
    ['EthEventsVext',      Schema.Unit],
    ['BridgePoolVext',     Schema.Unit],
    ['ValSetUpdateVext',   Schema.Unit],
  ]),
}

const headerFields = {
  chain_id:                    Schema.String,
  expiration:                  Schema.Option(Schema.String),
  timestamp:                   Schema.String,
  code_hash:                   hashSchema,
  data_hash:                   hashSchema,
  memo_hash:                   hashSchema,
  tx_type:                     schemaEnum([
    ['Raw',                    Schema.Unit],
    ['Wrapper',                Schema.Struct(wrapperTransactionFields)],
    ['Decrypted',              schemaEnum([
      ['Decrypted',            Schema.Unit],
      ['Undecryptable',        Schema.Unit],
    ])],
    ['Protocol',               Schema.Struct(protocolTransactionFields)],
  ])
}

const headerSchema = Schema.Struct(headerFields)

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

const extendedPointSchema = Schema.Struct({
  u:  Schema.Array(Schema.u64, 4),
  v:  Schema.Array(Schema.u64, 4),
  z:  Schema.Array(Schema.u64, 4),
  t1: Schema.Array(Schema.u64, 4),
  t2: Schema.Array(Schema.u64, 4),
})

const noteSchema = Schema.Struct({
  asset_type:   Schema.Struct({
    identifier: Schema.Array(Schema.u8, 32),
  }),
  value:        Schema.u64,
  g_d:          extendedPointSchema,
  pk_d:         extendedPointSchema,
  rseed:        schemaEnum([
    ['BeforeZip212', Schema.Array(Schema.u64, 4)],
    ['AfterZip212',  Schema.Array(Schema.u8, 32)],
  ]),
})

const merklePathSchema = Schema.Struct({
  auth_path: Schema.Vec(Schema.Struct({
    _0:      Schema.Struct({
      repr:  Schema.Array(Schema.u8, 32)
    }),
    _1:      Schema.bool
  })),
  position:  Schema.u64
})

const txSchema = Schema.Struct({
  header:                       headerSchema,
  sections:                     Schema.Vec(schemaEnum([
    ['Data',                    Schema.Struct({
      salt:                     Schema.Array(Schema.u8, 8),
      data:                     Schema.Vec(Schema.u8),
    })],
    ['ExtraData',               codeSchema],
    ['Code',                    codeSchema],
    ['Signature',               Schema.Struct({
      targets:                  Schema.Vec(hashSchema),
      signer:                   schemaEnum([
        ['Address',             addressSchema],
        ['PubKeys',             Schema.Vec(publicKeySchema)],
      ]),
      signatures:               Schema.HashMap(Schema.u8, schemaEnum([
        ['Ed25519',             Schema.Array(Schema.u8, 64)],
        ['Secp256k1',           Schema.Array(Schema.u8, 65)]
      ]))
    })],
    ['Ciphertext',              Schema.Struct({
      opaque:                   Schema.Vec(Schema.u8)
    })],
    ['MaspTx',                  Schema.Struct({
      txid:                     Schema.Array(Schema.u8, 32),
      data:                     Schema.Struct({
        version:                schemaEnum([
          ['MASPv5',            Schema.Unit]
        ]),
        consensus_branch_id:    schemaEnum([
          ['MASP',              Schema.Unit]
        ]),
        lock_time:              Schema.u32,
        expiry_height:          Schema.u32,
        transparent_bundle:     Schema.Option(bundleSchema),
        sapling_bundle:         Schema.Option(bundleSchema),
      }),
    })],
    ['MaspBuilder',             Schema.Struct({
      hash:                     hashSchema,
      asset_types:              Schema.HashSet(Schema.Struct({
        token:                  addressSchema,
        denomination:           Schema.u8,
        position:               schemaEnum([
          ['Zero',              Schema.Unit],
          ['One',               Schema.Unit],
          ['Two',               Schema.Unit],
          ['Three',             Schema.Unit],
        ]),
        epoch:                  Schema.Option(Schema.u64)
      })),
      metadata:                 Schema.Struct({
        spend_indices:          Schema.Vec(Schema.u32),
        convert_indices:        Schema.Vec(Schema.u32),
        output_indices:         Schema.Vec(Schema.u32),
      }),
      builder:                  Schema.Struct({
        params:                 Schema.Unit,
        rng:                    Schema.Unit,
        target_height:          Schema.u32,
        expiry_height:          Schema.u32,
        transparent_builder:    Schema.Struct({
          inputs:               Schema.Vec(Schema.Struct({
            coin:               txOutSchema
          })),
          vout:                 Schema.Vec(txOutSchema)
        }),
        sapling_builder:        Schema.Struct({
          params:               Schema.Unit,
          spend_anchor:         Schema.Option(Schema.Array(Schema.u64, 4)),
          target_height:        Schema.u32,
          value_balance:        Schema.i128,
          convert_anchor:       Schema.Option(Schema.Array(Schema.u64, 4)),
          spends:               Schema.Vec(Schema.Struct({
            extsk:              Schema.Struct({
              depth:            Schema.u8,
              parent_fvk_tag:   Schema.Array(Schema.u8, 4),
              child_index:      schemaEnum([
                ['NonHardened', Schema.u32],
                ['Hardened',    Schema.u32],
              ]),
              chain_code:       Schema.Array(Schema.u8, 32),
              fbk:              Schema.Struct({
                vk:             Schema.Struct({
                  ak:           extendedPointSchema,
                  nk:           extendedPointSchema,
                }),
                ovk:            Schema.Array(Schema.u8, 32),
              }),
              dk:               Schema.Array(Schema.u8, 32),
            }),
            diversifier:        Schema.Array(Schema.u8, 11),
            note:               noteSchema,
            alpha:              Schema.Array(Schema.u64, 4),
            merkle_path:        merklePathSchema
          })),
          converts:             Schema.Vec(Schema.Struct({
            allowed:            Schema.Struct({
              assets:           Schema.i128,
              generator:        extendedPointSchema
            }),
            value:              Schema.u64,
            merkle_path:        merklePathSchema,
          })),
          outputs:              Schema.Vec(Schema.Struct({
            ovk:                Schema.Option(Schema.Array(Schema.u8, 32)),
            to:                 Schema.Struct({
              pk_d:             extendedPointSchema,
              diversifier:      Schema.Array(Schema.u8, 11)
            }),
            note:               noteSchema,
            memo:               Schema.Array(Schema.u8, 512)
          })),
        })
      })
    })],
    ['Header',                  headerSchema]
  ]))
})
