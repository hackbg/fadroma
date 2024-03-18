export class UpdateStewardCommission {
  static noun = 'Steward Commission Update'
  steward:    string
  commission: Map<string, bigint>
}

export class ResignSteward {
  static noun = 'Steward Resignation'
  steward: string
}
