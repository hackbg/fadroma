import * as Core from '../index.ts'
Core.chain
Core.chain({ id: 'test', })
Core.chain({ id: 'test', }).connect()
const stubApi: any = { test () { return "ok" } }
Core.chain({ id: 'test', }, stubApi)
Core.chain({ id: 'test', }, stubApi).connect()
