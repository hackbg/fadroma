
//export class BecomeValidator extends Struct(
  //["address",                    addr],
  //["consensus_key",              pubkey],
  //["eth_cold_key",               pubkey],
  //["eth_hot_key",                pubkey],
  //["protocol_key",               pubkey],
  //["commission_rate",            u256],
  //["max_commission_rate_change", u256],
  //["email",                      string],
  //["description",                option(string)],
  //["website",                    option(string)],
  //["discord_handle",             option(string)],
  //["avatar",                     option(string)],
//) {
  //address
  //consensusKey
  //ethColdKey
  //ethHotKey
  //protocolKey
  //commissionRate
  //maxCommissionRateChange
  //email
  //description
  //website
  //discordHandle
  //avatar
//}

//export class Bond extends Struct(
  //["validator", addr],
  //["amount",    u256],
  //["source",    option(addr)],
//) {
  //validator: Address
  //amount:    bigint
  //source:    null|Address
//}

//export class ClaimRewards extends Struct(
  //["validator", addr],
  //["source",    option(addr)],
//) {
  //validator: Address
  //source:    null|Address
//}

//export class ConsensusKeyChange extends Struct(
  //["validator",     addr],
  //["consensus_key", pubkey],
//) {
  //validator:     Address
  //consensusKey:  unknown
//}

//export class CommissionChange extends Struct(
  //["validator", addr],
  //["new_rate",  i256],
//) {
  //validator: Address
  //newRate:   bigint
//}

//export class MetaDataChange extends Struct(
  //["validator",       addr],
  //["email",           option(string)],
  //["description",     option(string)],
  //["website",         option(string)],
  //["discord_handle",  option(string)],
  //["avatar",          option(string)],
  //["commission_rate", option(i256)],
//) {
  //validator:      Address
  //email:          null|string
  //description:    null|string
  //website:        null|string
  //discordHandle:  null|string
  //avatar:         null|string
  //commissionRate: null|string
//}

//export class Redelegation extends Struct(
  //["src_validator",  addr],
  //["dest_validator", addr],
  //["owner",          addr],
  //["amount",         i256],
//) {
  //srcValidator:   Address
  //destValidator:  Address
  //owner:          Address
  //amount:         bigint
//}

//export class Unbond extends Struct() {}

//export class Withdraw extends Struct(
  //["validator", addr],
  //["source",    option(addr)],
//) {
  //validator: Address
  //source:    null|Address
//}

//export class DeactivateValidator extends Struct() {}

//export class ReactivateValidator extends Struct() {}

//export class UnjailValidator extends Struct() {}

