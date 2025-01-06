import * as Core from '../index.ts'

console.log(Core.chain)
console.log()

console.log(Core.chain({ id: 'test', }))
console.log(Core.chain({ id: 'test', }).connect())
console.log()

const stubApi = {
  test () { return "ok" }
}
console.log(Core.chain({ id: 'test', }, stubApi as any))
console.log(Core.chain({ id: 'test', }, stubApi as any).connect())
