import * as TM from '../index.ts'

console.log(TM.chain)
console.log()

console.log(TM.chain({ id: 'test' }))
console.log(TM.chain({ id: 'test' }).connect('test'))
console.log()
