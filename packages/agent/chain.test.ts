/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import assert, { equal, throws, rejects } from 'node:assert'
import { Connection, Identity, Endpoint, Backend, Contract, Batch } from './chain'
import { ContractInstance } from './deploy'
import { fixture } from '@fadroma/fixtures'
import { Error } from './core'
import * as Stub from './stub'

import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ["height", testHeight],
  ["codes",  testCodes],
  ["auth",   testAuth],
  ["batch",  testBatch],
  ["client", testClient],
])

export async function testHeight () {
  const connection = new Stub.StubConnection()
  assert(
    await connection.height)
  assert(
    await connection.nextBlock)
  Object.defineProperty(connection, 'height', { configurable: true, get () {
    return Promise.resolve('NaN')
  } })
  assert.equal(
    await connection.nextBlock, NaN)
  Object.defineProperty(connection, 'height', { configurable: true, get () {
    Object.defineProperty(connection, 'height', { configurable: true, get () {
      throw new Error('yeet')
    } })
    return Promise.resolve(0)
  } })
  assert.rejects(
    ()=>connection.nextBlock)
  assert(
    await connection.query('', {}))
}

export async function testCodes () {

  const backend = new Stub.StubBackend({})
  backend.uploads.set("123", { codeHash: "abc", codeData: new Uint8Array() } as any)
  backend.instances.set("stub1abc", {
    codeId:  "123",
    address: 'stub1instancefoo',
    creator: 'stub1instancefoo'
  })

  const connection = new Stub.StubConnection({ backend })
  assert.equal(
    await connection.getCodeId('stub1abc'), "123")
  assert.equal(
    await connection.getCodeHashOfAddress('stub1abc'), "abc")
  assert.equal(
    await connection.getCodeHashOfCodeId('123'), "abc")

}

export async function testAuth () {
  throws(()=>new Identity().sign(''))
  const identity = new Identity({ name: 'foo', address: 'foo1bar' })
  const connection = new Stub.StubConnection({ identity })
  //assert.equal(connection[Symbol.toStringTag], 'stub (mocknet): testing1')
  assert(connection instanceof Stub.StubConnection)
  assert(connection.identity?.address)
  assert(connection.identity?.name)
  connection.height
  connection.nextBlock
  await connection.query('', {})
  await connection.send('x', [])
  //await connection.sendMany([])

  await connection.upload(fixture('empty.wasm'), {})
  await connection.upload(new Uint8Array(), {})

  await connection.instantiate('1', { label: 'foo', initMsg: 'bar' })
  await connection.instantiate({ codeId: '2' }, { label: 'foo', initMsg: {} })
  rejects(()=>connection.instantiate('foo', {}))
  rejects(()=>connection.instantiate('', {}))
  rejects(()=>connection.instantiate('1', { label: 'foo' }))
  rejects(()=>connection.instantiate('1', { initMsg: {} }))

  await connection.getContractsByCodeId('1')
  rejects(connection.getContractsByCodeIds(null as any))
  await connection.getContractsByCodeIds(['1', '2'])
  await connection.getContractsByCodeIds({'1': Contract, '2': Contract})

  await connection.execute('stub', {}, {})
  await connection.execute('stub', 'method', {})
  await connection.execute('stub', {'method':'man'}, {})
  await connection.execute({ address: 'stub' }, {}, {})
  await connection.execute({ address: 'stub' }, 'method', {})
  await connection.execute({ address: 'stub' }, {'method':'crystal'}, {})

  throws(()=>new Stub.StubConnection().balance)
  throws(()=>new Stub.StubConnection().getBalanceOf(null as any))
  throws(()=>new Stub.StubConnection().getBalanceOf('addr', false as any))
  assert(await new Stub.StubConnection().getBalanceOf('addr'))
  throws(()=>new Stub.StubConnection().getBalanceIn(null as any))
  throws(()=>new Stub.StubConnection().getBalanceIn('token', null as any))
  assert(await new Stub.StubConnection().getBalanceIn('token', 'addr'))
}

export async function testBatch () {
  const connection = new Stub.StubConnection({ identity: new Identity() })
  const batch = connection.batch()
    .upload({})
    .upload({})
    .instantiate({}, {})
    .instantiate({}, {})
    .execute({}, {})
    .execute({}, {})
  assert(batch instanceof Batch)
  await batch.submit()
}

export async function testClient () {
  const instance   = { address: 'addr', codeHash: 'code-hash-stub', codeId: '100' }
  const connection = new Stub.StubConnection()
  const client     = connection.getContract(instance)
  assert.equal(client.connection, connection)
  assert.equal(client.instance, instance)
  await client.query({foo: 'bar'})
  await client.execute({foo: 'bar'})
  await connection.getContract('addr')

  assert(new Contract('addr'))
  assert(new Contract(new ContractInstance({ address: 'addr' })))
  assert.throws(()=>new Contract({}).query({}))
  assert.throws(()=>new Contract({ connection }).query({}))
  assert.throws(()=>new Contract({}).execute({}))
  assert.throws(()=>new Contract({ connection }).execute({}))
  assert.throws(()=>new Contract({ connection: {} as any }).execute({}))
}
