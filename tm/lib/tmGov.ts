import type { Core } from '../deps.ts'
/** A Namada governance vote. */
export interface Vote { proposal: ProposalId, voter: Core.Address, power: bigint, value: VoteValue }
/** The value of a Namada governance vote. */
export type VoteValue = 'Yay'|'Nay'|'Abstain'
/** The current state of a Namada governance proposal. */
export interface Proposal { id: ProposalId, votes: Vote[], result: ProposalResult }
/** The number of a Namada governance proposal. */
export type ProposalId = bigint
/** The result of a Namada governance proposal. */
export type ProposalResult = 'Pass'|'Fail'

