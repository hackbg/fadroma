import * as Core from './index.ts'
import * as assert from 'node:assert'
Deno.test('core chain', () => {
  Core.chain
  Core.chain({ id: 'test', })
  Core.chain({ id: 'test', }).connect()
  const stubApi: any = { test () { return "ok" } }
  Core.chain({ id: 'test', }, stubApi)
  Core.chain({ id: 'test', }, stubApi).connect()
})
Deno.test('timed logger', async () => {
  await Core.timed(() => Promise.resolve(), (...args)=>console.log({timed: args}))
})
Deno.test('pickRandom', () => {
  const values = ['ka', 'ram', 'bol']
  const picked = Core.pickRandom(new Set(values))
  assert.ok(values.includes(picked))
})
Deno.test('base error type has 2nd arg', () => {
  assert.equal((new Core.Error('message', { parameter: 'value' }) as any).parameter, 'value')
})
