/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import assert from 'node:assert'
import { Chain } from './chain'
import { StubChain, StubAgent } from './stub'
import { ContractClient } from './client'
import { ContractInstance } from './deploy'

export default async function testClient () {
  const chain = new StubChain({ id: 'foo', mode: Chain.Mode.Testnet })
  const agent = new StubAgent({ chain })
  const client = new ContractClient({
    address:  'addr',
    codeHash: 'code-hash-stub',
    codeId:   '100'
  }, agent)
  assert.equal(client.agent, agent)
  assert.equal(client.chain, chain)
  await client.query({foo: 'bar'})
  await client.execute({foo: 'bar'})

  assert(new ContractClient('addr'))
  assert(new ContractClient(new ContractInstance({ address: 'addr' })))
  assert.throws(()=>new ContractClient({}).query({}))
  assert.throws(()=>new ContractClient({}, agent).query({}))
  assert.throws(()=>new ContractClient({}).execute({}))
  assert.throws(()=>new ContractClient({}, agent).execute({}))
}

