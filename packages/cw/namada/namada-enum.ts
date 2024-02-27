import * as Borsher from 'borsher'

/** BorshSchema.Enum results in an unordered enum.
  * This function generates enum schema where the
  * discriminant corresponds to array index of the variant. */
export function schemaEnum (variants: [string, Borsher.BorshSchema][]) {
  return Borsher.BorshSchema.from({
    enum: variants.map(([k, v])=>({ struct: { [k]: v.into() } }))
  })
}
