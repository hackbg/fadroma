/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program. If not, see <http://www.gnu.org/licenses/>. **/
import type { Address } from '../../index.ts'

export type ProposalId = bigint

export type ProposalResult = 'Pass'|'Fail'

export interface Proposal {
  id:     ProposalId
  votes:  Vote[]
  result: ProposalResult
}

export type VoteValue = 'Yay'|'Nay'|'Abstain'

export interface ProposalVote {
  proposal: ProposalId
  voter:    Address
  power:    bigint
  value:    VoteValue
}
