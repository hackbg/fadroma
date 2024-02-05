import type { CodeId } from '@fadroma/agent'
import { Chain } from '@fadroma/agent'

export type ObjectariumVersion = string

/** Code IDs for versions of Objectarium contract. */
export const objectariumCodeIds: Record<ObjectariumVersion, CodeId> = {
  "v2.0.0": "4"
}

/** OKP4 object store. */
export class Objectarium extends Chain.Contract {

  /** Create an init message for an objectarium. */
  static init = (bucket: string) => ({ bucket })

  store = (pin: boolean, data: string) => this.execute({
    store_object: { data, pin }
  })

  pin = (id: string) => this.execute({
    pin_object: { id }
  })

  unpin = (id: string) => this.execute({
    unpin_object: { id }
  })

  forget = (id: string) => this.execute({
    forget_object: { id }
  })

  static ['v2.0.0'] = class Objectarium_v2_1_0 extends Objectarium {
    static client = this
    //static codeHash = ''
    static codeId = {
      'okp4-nemeton-1': 4
    }
  }

}

