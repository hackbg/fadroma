import MocknetError from './MocknetError'
import type { Ptr, IOExports } from './MocknetData'

import type { Address, CodeHash, ChainId } from '@fadroma/core'

export default interface ContractExports extends IOExports {
  query (msg: Ptr): Ptr
}

export function makeContext (now: number = + new Date()) {
  const height = Math.floor(now/5000)
  const time = Math.floor(now/1000)
  const sent_funds: any[] = []
  return { height, time, sent_funds }
}

//type CW<V extends '0'|'1'> = {
  //'0':{},
  //'1':{}
//}[V]
