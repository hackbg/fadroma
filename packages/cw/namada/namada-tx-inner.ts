import { Core } from '@fadroma/agent'
import * as Borsher from 'borsher'
import { addressSchema } from './namada-address'
import { fromBorshStruct } from './namada-struct'
const { BorshSchema: Schema, borshDeserialize: deserialize } = Borsher

export class TXBridgePool extends fromBorshStruct({}) {}

export class TXIBC extends fromBorshStruct({}) {}

export class TXInitAccount extends fromBorshStruct({}) {}

export class TXInitProposal extends fromBorshStruct({}) {}

export class TXResignSteward extends fromBorshStruct({}) {}

export class TXRevealPK extends fromBorshStruct({}) {}

export class TXTransfer extends fromBorshStruct({}) {}

export class TXUpdateAccount extends fromBorshStruct({}) {}

export class TXVoteProposal extends fromBorshStruct({}) {}

export class VPImplicit extends fromBorshStruct({}) {}

export class VPUser extends fromBorshStruct({}) {}
