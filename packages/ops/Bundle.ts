import { Console } from '@hackbg/tools'

const console = Console('@fadroma/ops/Bundle')

import { Artifact, Template, Instance, Message } from './Core'
import { Agent } from './Agent'
import { Chain } from './Chain'

export type BundleWrapper = (bundle: Bundle) => Promise<any>

export abstract class Bundle {

  constructor (readonly agent: Agent) {}

  get chain   () { return this.agent.chain }
  get chainId () { return this.agent.chain.id }
  get address () { return this.agent.address }

  abstract upload  (artifact: Artifact): this
  abstract init    (template: Template, label: string, msg: Message): this
  abstract execute (instance: Instance, msg: Message): this

  private depth = 0
  bundle (): this {
    console.warn('Nest bundles with care. Depth:', ++this.depth)
    return this
  }
  run (memo: string): Promise<BundleResult[]|null> {
    if (this.depth > 0) {
      console.warn('Unnesting bundle. Depth:', ++this.depth)
      this.depth--
      return null
    } else {
      return this.submit(memo)
    }
  }
  async wrap (cb: BundleWrapper) {
    await cb(this)
    return this.run("")
  }
  abstract submit (memo: string): Promise<BundleResult[]>

  protected id: number = 0
  protected msgs: Promise<any>[] = []
  protected add (msg: any): number {
    const id = this.id++
    this.msgs[id] = msg
    return id
  }
}

export type BundleResult = {
  tx:        string
  type:      string
  chainId:   string
  codeId?:   string
  codeHash?: string
  address?:  string
  label?:    string
}
