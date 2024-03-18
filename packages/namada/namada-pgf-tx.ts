import { Core } from '@fadroma/cw'

export class UpdateStewardCommission {
  static noun = 'Steward Commission Update'
  steward!:    string
  commission!: Record<string, bigint>
  constructor (properties: Partial<UpdateStewardCommission> = {}) {
    Core.assign(this, properties, [
      "steward",
      "commission"
    ])
  }
}

export class ResignSteward {
  static noun = 'Steward Resignation'
  steward: string
  constructor (properties: Partial<ResignSteward> = {}) {
    Core.assign(this, properties, [
      "steward",
    ])
  }
}
