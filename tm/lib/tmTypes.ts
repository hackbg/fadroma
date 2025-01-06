import * as Base from '../deps.ts'
/** A Namada chain. */
export interface Chain extends Base.ChainBase<Connection> { bech32Prefix?: string }
/** A Namada connection. */
export interface Connection extends Base.Connection { url: string|URL }
/** A Namada block. */
export interface Block extends Base.Block { hash: unknown }
/** A Namada transaction. */
export interface Transaction extends Base.Transaction { chain: Chain, hash:  Base.Hash }
/** A Namada governance vote. */
export interface Vote { proposal: ProposalId, voter: Base.Address, power: bigint, value: VoteValue }
/** The value of a Namada governance vote. */
export type VoteValue = 'Yay'|'Nay'|'Abstain'
/** The current state of a Namada governance proposal. */
export interface Proposal { id: ProposalId, votes: Vote[], result: ProposalResult }
/** The number of a Namada governance proposal. */
export type ProposalId = bigint
/** The result of a Namada governance proposal. */
export type ProposalResult = 'Pass'|'Fail'
/** A Namada validator. */
export interface Validator {
  address?: Base.Address, publicKey?: Base.Hash, votingPower: bigint, proposerPriority: bigint
}
