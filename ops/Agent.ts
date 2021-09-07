import type { Chain } from './ChainAPI'

export type Identity = {
  chain?:    Chain,
  name?:     string,
  type?:     string,
  address?:  string
  pubkey?:   string
  mnemonic?: string
  keyPair?:  any
  pen?:      any
  fees?:     any
}

export abstract class Agent implements Identity {
  readonly chain:   Chain
  readonly address: string
  readonly name:    string
  fees: Record<string, any>

  type?:     string
  pubkey?:   string
  mnemonic?: string
  keyPair?:  any
  pen?:      any

  abstract get nextBlock (): Promise<void>
  abstract get block     (): Promise<any>
  abstract get account   (): Promise<any>
  abstract get balance   (): Promise<any>

  abstract getBalance (denomination: string): Promise<any>

  abstract send (recipient:        any,
                 amount: string|number,
                 denom?:           any,
                 memo?:            any,
                 fee?:             any): Promise<any>

  abstract sendMany (txs: Array<any>,
                     memo?:   string,
                     denom?:  string,
                     fee?:       any): Promise<any>

  abstract upload (path:   string): Promise<any>

  abstract instantiate (codeId: number,
                        label:  string,
                        initMsg:   any): Promise<any>

  abstract query (link:      any,
                  method: string,
                  args?:     any): Promise<any>

  abstract execute (link:      any,
                    method: string,
                    args?:     any,
                    memo?:     any,
                    transfer?: any,
                    fee?:      any): Promise<any>
}

/** Check if the passed instance has required methods to behave like an Agent */
export const isAgent = (maybeAgent: any): boolean => (
  maybeAgent
  && typeof maybeAgent         === "object"
  && typeof maybeAgent.query   === "function"
  && typeof maybeAgent.execute === "function")
