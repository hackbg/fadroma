import * as Borsher from 'borsher'
const Schema = Borsher.BorshSchema

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
