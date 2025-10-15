import * as TM from '../index.ts'
Deno.test('tendermint chain', () => {
  TM.chain
  TM.chain({ id: 'test' })
  TM.chain({ id: 'test' }).connect('test')
})
