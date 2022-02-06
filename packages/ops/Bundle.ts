import { Artifact, Template, Instance, ContractMessage } from './Core'
import { Agent } from './Agent'
import { Chain } from './Chain'

export interface Bundle<T> {
  readonly agent:   Agent
  readonly chain:   Chain
  readonly address: string
  upload  (artifact: Artifact): this
  init    (template: Template, label: string, initMsg: ContractMessage): this
  execute (instance: Instance, handleMsg: ContractMessage): this
  run (): Promise<T>
}

export abstract class BaseBundle<T> implements Bundle<T> {
  constructor (readonly agent: Agent) {}
  get chain () { return this.agent.chain }
  get address () { return this.agent.address }
  abstract upload  (artifact: Artifact): this
  abstract init    (template: Template, label: string, initMsg: ContractMessage): this
  abstract execute (instance: Instance, handleMsg: ContractMessage): this
  abstract run (): Promise<T>
  protected id: number = 0
  protected msgs: Promise<any>[] = []
  protected add (msg: any): number {
    const id = this.id++
    this.msgs[id] = msg
    return id
  }
}
