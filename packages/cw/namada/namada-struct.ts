import * as Borsher from 'borsher'
import { Core } from '@fadroma/agent'
export function fromBorshStruct (fields) {
  const schema = Borsher.BorshSchema.Struct(fields)
  return class {
    static fromBorsh (binary: Uint8Array) {
      return new this(
        Borsher.borshDeserialize(schema, binary)
      )
    }
    constructor (data) {
      if (data) {
        Core.assignCamelCase(this, data, Object.keys(fields))
      }
    }
  }
}
