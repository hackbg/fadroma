import { Core } from '@fadroma/agent'

export class Section {
  static noun = 'Section'
  type!: null
    |'Data'
    |'ExtraData'
    |'Code'
    |'Signature'
    |'Ciphertext'
    |'MaspTx'
    |'MaspBuilder'
    |'Header'
  constructor (properties: Partial<Section> = {}) {
    Core.assign(this, properties, [
      "type"
    ])
  }
}

