/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/

// Private module, don't reexport!

import type { ChainId } from '@fadroma/agent'

export default {
  'secret-4': new Set([
    `https://faucet.secretsaturn.net/`
  ]),
  'pulsar-3': new Set([
    `https://faucet.pulsar.scrttestnet.com/`
  ])
} as Record<ChainId, Set<string>>
