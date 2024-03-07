import * as Borsher from 'borsher'

/** BorshSchema.Enum results in an unordered enum.
  * This function generates enum schema where the
  * discriminant corresponds to array index of the variant. */
export function schemaEnum (variants: [string, Borsher.BorshSchema][]) {
  return Borsher.BorshSchema.from({
    enum: variants.map(([k, v])=>({ struct: { [k]: v.into() } }))
  })
}

export function enumVariant <T extends object, K extends keyof T> (enumInstance: T): [K, T[K]] {
  const keys = Object.keys(enumInstance) as K[]
  if (keys.length !== 1) {
    throw new Error('enum variant should have exactly 1 key')
  }
  return [keys[0], enumInstance[keys[0]]]
}
