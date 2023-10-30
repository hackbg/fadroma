/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import assert from 'node:assert'
import { Mode } from './chain'
import * as Stub from './stub'
import { ContractClient } from './client'
import { ContractInstance } from './deploy'

export default async function testClient () {
  const contract = { address: 'addr', codeHash: 'code-hash-stub', codeId: '100' }
  const agent    = new Stub.Agent({ chainId: 'foo', mode: Mode.Testnet })
  const client   = new ContractClient(contract, agent)
  assert.equal(client.agent, agent)
  assert.equal(client.contract, contract)
  await client.query({foo: 'bar'})
  await client.execute({foo: 'bar'})

  assert(new ContractClient('addr'))
  assert(new ContractClient(new ContractInstance({ address: 'addr' })))
  assert.throws(()=>new ContractClient({}).query({}))
  assert.throws(()=>new ContractClient({}, agent).query({}))
  assert.throws(()=>new ContractClient({}).execute({}))
  assert.throws(()=>new ContractClient({}, agent).execute({}))
}

