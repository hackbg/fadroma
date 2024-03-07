import * as Borsher from 'borsher'
import { Core } from '@fadroma/agent'

export const Schema = Borsher.BorshSchema

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
    print (console) {
      throw new Core.Error(`print ${this.constructor.name}: not implemented`)
    }
  }
}

/** BorshSchema.Enum results in an unordered enum.
  * This function generates enum schema where the
  * discriminant corresponds to array index of the variant. */
export function schemaEnum (variants: [string, Borsher.BorshSchema][]) {
  return Schema.from({
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

export const u256Schema = Schema.Array(Schema.u8, 32)

export function decodeU256Fields <T> (object: T, fields: (keyof T)[]) {
  for (const field of fields) {
    if (
      ((object[field] as unknown) instanceof Array) ||
      ((object[field] as unknown) instanceof Uint8Array)
    ) {
      const bytes = object[field] as unknown as Array<number>
      ;(object[field] as bigint) = 0n
      for (let i = bytes.length - 1; i >= 0; i--) {
        ;(object[field] as bigint) = (object[field] as bigint) * 256n + BigInt(bytes[i])
      }
    }
  }
}

export function decodeU256 (bytes: number[]) {
  let number = 0n
  for (let i = bytes.length - 1; i >= 0; i--) {
    number = number * 256n + BigInt(bytes[i])
  }
  return number
}

export const i256Schema = Schema.Array(Schema.u8, 32)

export function decodeI256 (bytes: number[]) {
  let number = 0n
  for (let i = bytes.length - 1; i >= 0; i--) {
    number = number * 256n + BigInt(bytes[i])
  }
  return number
}
