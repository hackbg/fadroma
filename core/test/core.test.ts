import * as Core from '../index.ts'

console.log(Core.chain)
console.log(Core.chain({
  id: 'test',
}))
console.log(Core.chain({
  id: 'test',
}).connect())
