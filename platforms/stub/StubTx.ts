/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/

import { Block, Batch, Transaction } from '@hackbg/fadroma'
import type { StubChain } from './StubChain'
import type { StubAgent } from './StubIdentity'

export class StubBlock extends Block {
  async getTransactionsById (): Promise<Record<string, Transaction>> {
    return {}
  }
  async getTransactionsInOrder (): Promise<Transaction[]> {
    return []
  }
}

export class StubBatch extends Batch {
  declare agent: StubAgent
  messages: object[] = []

  upload (...args: Parameters<StubAgent["upload"]>) {
    this.messages.push({ upload: args })
    return this
  }

  instantiate (...args: Parameters<StubAgent["instantiate"]>) {
    this.messages.push({ instantiate: args })
    return this
  }

  execute (...args: Parameters<StubAgent["execute"]>) {
    this.messages.push({ execute: args })
    return this
  }

  async submit () {
    this.log.debug('Submitted batch:\n ', this.messages
      .map(x=>Object.entries(x)[0].map(x=>JSON.stringify(x)).join(': '))
      .join('\n  '))
    return this.messages
  }
}
