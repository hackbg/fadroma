import { Artifact, Template, Instance, Message } from './Core'
import { Agent } from './Agent'
import { Chain } from './Chain'

export type Bundled<T> = (bundle: Bundle<T>)=>Promise<void>

export interface Bundle<T> {
  readonly agent:   Agent
  readonly chain:   Chain
  readonly address: string
  upload  (artifact: Artifact): this
  init    (template: Template, label: string, initMsg: Message): this
  execute (instance: Instance, handleMsg: Message): this

  run (): Promise<any>
  wrap (cb: Bundled<T>): Promise<T>
}

export abstract class BaseBundle<T> implements Bundle<T> {
  constructor (readonly agent: Agent) {}
  get chain () { return this.agent.chain }
  get address () { return this.agent.address }
  abstract upload  (artifact: Artifact): this
  abstract init    (template: Template, label: string, initMsg: Message): this
  abstract execute (instance: Instance, handleMsg: Message): this
  abstract run (): Promise<any>
  protected id: number = 0
  protected msgs: Promise<any>[] = []
  protected add (msg: any): number {
    const id = this.id++
    this.msgs[id] = msg
    return id
  }
  async wrap (cb: (bundle: Bundle<T>)=>Promise<void>) {
    await cb(this)
    return this.run()
  }
}
