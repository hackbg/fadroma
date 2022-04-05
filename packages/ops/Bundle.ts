import { Console, bold } from '@hackbg/tools'
import { Source, Artifact, Template, Instance, Message } from './Core'
import { Agent } from './Agent'
import { Chain } from './Chain'

export type BundleWrapper = (bundle: Bundle) => Promise<any>

const console = Console('@fadroma/ops/Bundle')

export abstract class Bundle {

  constructor (readonly agent: Agent) {}

  get chain   () { return this.agent.chain }

  get chainId () { return this.agent.chain.id }

  get address () { return this.agent.address }

  private depth = 0

  /** Opening a bundle from within a bundle
    * returns the same bundle with incremented depth. */
  bundle (): this {
    console.warn('Nest bundles with care. Depth:', ++this.depth)
    return this
  }

  /** Execute the bundle if not nested;
    * decrement the depth if nested. */
  run (memo: string): Promise<BundleResult[]|null> {
    if (this.depth > 0) {
      console.warn('Unnesting bundle. Depth:', --this.depth)
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

  protected id: number = 0
  protected msgs: Array<any> = []

  /** Add a message to the bundle, incrementing
    * the bundle's internal message counter. */
  protected add (msg: any): number {
    const id = this.id++
    this.msgs[id] = msg
    return id
  }

  abstract upload  (artifact: Artifact): Promise<this>

  abstract init    (template: Template, label: string, msg: Message, send: any[]): Promise<this>

  abstract execute (instance: Instance, msg: Message): Promise<this>

  abstract submit  (memo: string): Promise<BundleResult[]>

  abstract save    (name: string): Promise<void>

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
