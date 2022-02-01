import { BaseChain } from './Chain'
import { BaseAgent } from './Agent'
import { Directory } from '@hackbg/tools'
import { URL } from 'url'

export class Mocknet extends BaseChain {
  id         = 'mocknet'
  isLocalnet = true
  apiURL     = new URL('mock://mock:0')
  stateRoot  = new Directory(`/tmp/fadroma_mocknet_${Math.floor(Math.random()*1000000)}`)
  Agent      = MockAgent
  defaultIdentity = new this.Agent()
  constructor () {
    super()
    this.setDirs()
  }
}

export class MockAgent extends BaseAgent {
  address = 'mock'

  get nextBlock ()
    { return Promise.resolve()  }
  get block ()
    { return Promise.resolve(0) }
  get account ()
    { return Promise.resolve()  }
  get balance ()
    { return Promise.resolve(0) }
  getBalance (_: string)
    { return Promise.resolve(0) }
  send (_1:any, _2:any, _3?:any, _4?:any, _5?:any)
    { return Promise.resolve() }
  sendMany (_1:any, _2:any, _3?:any, _4?:any)
    { return Promise.resolve() }
  upload (_:any)
    { return Promise.resolve({codeId:1}) }
  instantiate (_1: any, _2: any, _3: any) 
    { return Promise.resolve({}) }
  query (_1: any, _2: any) 
    { return Promise.resolve({}) }
  execute (_1: any, _2: any, _3: any, _4?: any, _5?: any) 
    { return Promise.resolve({}) }
  getCodeHash (_: any) 
    { return Promise.resolve("SomeCodeHash") }
  getCodeId (_: any) 
    { return Promise.resolve(1) }
  getLabel (_: any) 
    { return Promise.resolve("SomeLabel") }
  static create ()
    { return new MockAgent() }
}
