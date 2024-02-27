import { BorshSchema as Schema } from 'borsher'

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
