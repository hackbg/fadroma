/** Borsh encoding and decoding. */

// TODO
export type AnyField = {
  encode (buffer: Writer, value: unknown): void
  decode (buffer: Reader): unknown
}

export type Field<T> = {
  encode (buffer: Writer, value: T): void
  decode (buffer: Reader): T
}

/** The unit type (empty). */
export const unit: Field<void> = ({
  encode (buffer: Writer, value: void) {},
  decode (buffer: Reader): void {}
})

/** Contains the state of an encoding operation. */
export class Writer {
  offset:     number      = 0
  bufferSize: number      = 256
  buffer:     ArrayBuffer = new ArrayBuffer(this.bufferSize)
  view:       DataView    = new DataView(this.buffer)

  grow (needed_space: number): void {
    if (this.bufferSize - this.offset < needed_space) {
      this.bufferSize = Math.max(this.bufferSize * 2, this.bufferSize + needed_space);
      const new_buffer = new ArrayBuffer(this.bufferSize);
      new Uint8Array(new_buffer).set(new Uint8Array(this.buffer));
      this.buffer = new_buffer;
      this.view = new DataView(new_buffer);
    }
  }

  getUsed (): Uint8Array {
    return new Uint8Array(this.buffer).slice(0, this.offset);
  }

  write (from: Uint8Array): void {
    this.grow(from.length);
    new Uint8Array(this.buffer).set(new Uint8Array(from), this.offset);
    this.offset += from.length;
  }

  writeNumber (value: number|bigint, type: NativeNumber): void {
    const native = nativeSetter(type)
    if (native) {
      const [toCall, size] = native
      this.grow(size);
      ;(this.view[toCall as keyof DataView] as Function)(this.offset, value, true);
      this.offset += size;
    } else {
      throw new Error(`writeNumber got invalid type hint: ${type}`)
    }
  }
}

/** Contains the state of a decoding operation. */
export class Reader {
  offset:     number = 0
  bufferSize: number
  buffer:     ArrayBuffer
  view:       DataView

  constructor (buf: Uint8Array) {
    this.bufferSize = buf.length
    this.buffer     = new ArrayBuffer(buf.length)
    new Uint8Array(this.buffer).set(buf)
    this.view       = new DataView(this.buffer)
  }

  assertEnough (size: number): void {
    const start  = this.offset
    const end    = start + size
    const buffer = this.buffer.byteLength
    if (end > this.buffer.byteLength) {
      throw Object.assign(new Error('Error in schema, the buffer is smaller than expected'), {
        start,
        size,
        end,
        buffer,
        missing: end - this.buffer.byteLength
      })
    }
  }

  read (size: number): ArrayBuffer {
    this.assertEnough(size)
    const ret = this.buffer.slice(this.offset, this.offset + size)
    this.offset += size
    return ret
  }

  readNumber (type: NativeNumber): number|bigint {
    const native = nativeGetter(type)
    if (native) {
      const [toCall, size] = native
      this.assertEnough(size)
      const ret = (this.view[toCall as keyof DataView] as Function)(this.offset, true);
      this.offset += size
      return ret
    } else {
      throw new Error(`readNumber got invalid type hint: ${type}`)
    }
  }
}

/** Types for which there is a native DataView method. */
const nativeNumbers: Record<string, [keyof DataView, keyof DataView]> = {
  'u8':   [ 'getUint8',      'setUint8'     ],
  'u16':  [ 'getUint16',     'setUint16'    ],
  'u32':  [ 'getUint32',     'setUint32'    ],
  'u64':  [ 'getBigUint64',  'setBigUint64' ],

  'i8':   [ 'getInt8',       'setInt8'      ],
  'i16':  [ 'getInt16',      'setInt16',    ],
  'i32':  [ 'getInt32',      'setInt32'     ],
  'i64':  [ 'getBigInt64',   'setBigInt64'  ],

  'f32':  [ 'getFloat32',    'setFloat32'   ],
  'f64':  [ 'getFloat64',    'setFloat64'   ],
}

export const nativeInts = [1, 2, 4, 8]

export const nativeFloats = [4, 8]

type NativeNumber = keyof typeof nativeNumbers

const nativeGetter = (type: NativeNumber): [string, number]|null => {
  if (type in nativeNumbers) {
    const bSize = type.substring(1);
    return [nativeNumbers[type][0] as string, parseInt(bSize) / 8]
  }
  return null
}

const nativeSetter = (type: NativeNumber): [string, number]|null => {
  if (type in nativeNumbers) {
    const bSize = type.substring(1);
    return [nativeNumbers[type][1] as string, parseInt(bSize) / 8]
  }
  return null
}

/** A boolean value. */
export const bool: Field<boolean> = ({

  encode (buffer: Writer, value: boolean) {
    buffer.writeNumber(value as boolean ? 1 : 0, 'u8');
  },

  decode (buffer: Reader): boolean {
    return buffer.readNumber('u8') > 0;
  }

})

/** Either a value or NULL. */
export const option = <T>(element: Field<T>) => ({

  encode (buffer: Writer, value: T|null|undefined) {
    if (value === null || value === undefined) {
      buffer.writeNumber(0, 'u8')
      return
    }
    buffer.writeNumber(1, 'u8')
    element.encode(buffer, value)
  },

  decode (buffer: Reader): T|null {
    const option = buffer.readNumber('u8')
    if (option === 1) {
      return element.decode(buffer)
    }
    if (option !== 0) {
      throw new Error(`Invalid option ${option}`)
    }
    return null
  }

})

export const zOptional = {
}

/** A fixed-length ordered collection. */
export const array = <T>(size: number, element: Field<T>): Field<T[]> => ({
  encode (buffer: Writer, value: T[]) {
    if (value.length !== size) {
      throw new Error(`Expected array of size ${size}, got ${value.length}`)
    }
    for (let i = 0; i < size; i++) {
      element.encode(buffer, value[i])
    }
  },
  decode (buffer: Reader): T[] {
    const result: T[] = [];
    for (let i = 0; i < size; ++i) {
      result.push(element.decode(buffer))
    }
    return result;
  }
})

/** A variable-length ordered collection. */
export const vec = <T>(element: Field<T>): Field<T[]> => ({
  encode (buffer: Writer, value: T[]) {
    buffer.writeNumber(value.length, 'u32')
    for (let i = 0; i < value.length; i++) {
      element.encode(buffer, value[i])
    }
  },
  decode (buffer: Reader): T[] {
    const size = buffer.readNumber('u32')
    const result = []
    for (let i = 0; i < size; ++i) result.push(element.decode(buffer))
    return result
  }
})

export const zVec = <T>(element: Field<T>) => ({
  encode (buffer: never, value: T[]) {
    throw new Error('encode zVec: not implemented')
  },
  decode (buffer: Reader): T[] {
    const size = compact.decode(buffer)
    const result = []
    for (let i = 0n; i < size; ++i) {
      result.push(element.decode(buffer))
    }
    return result
  }
})

/** A variable-length unordered collection. */
export const set = <T>(element: Field<T>): Field<Set<T>> => ({
  encode (buffer: Writer, value: Set<T>|(T[])) {
    const isSet = value instanceof Set
    const values = isSet ? Array.from(value.values()) : Object.values(value)
    buffer.writeNumber(values.length, 'u32') // 4 bytes for length
    for (const value of values) { // set values
      element.encode(buffer, value)
    }
  },
  decode (buffer: Reader): Set<T> {
    const size = buffer.readNumber('u32')
    const result = new Set<T>()
    for (let i = 0; i < size; ++i) result.add(element.decode(buffer))
    return result;
  }
})

/** A key-value map. */
export const map = <K extends string|number|symbol, V>(k: Field<K>, v: Field<V>): Field<Map<K, V>> => ({
  encode (buffer: Writer, value: Record<K, V>|Map<K, V>) {
    const isMap = value instanceof Map;
    const keys = isMap ? Array.from(value.keys()) : Object.keys(value)
    buffer.writeNumber(keys.length, 'u32') // 4 bytes for length
    for (const key of keys) { // store key/values
      k.encode(buffer, key as K)
      v.encode(buffer, (isMap ? value.get(key as K) : value[key as K]) as V)
    }
  },
  decode (buffer: Reader): Map<K, V> {
    const size = buffer.readNumber('u32')
    const result = new Map()
    for (let i = 0; i < size; ++i) result.set(k.decode(buffer), v.decode(buffer))
    return result
  }
})

function isArrayLike (value: unknown): boolean {
  // source: https://stackoverflow.com/questions/24048547/checking-if-an-object-is-array-like
  return Array.isArray(value) || (!!value &&
    typeof value === 'object' &&
    'length' in value &&
    typeof (value.length) === 'number' &&
    (value.length === 0 ||
      (value.length > 0 &&
        (value.length - 1) in value)
    )
  )
}

export const zArray = {
}

/** An enum variant which may have additional data attached. */
export const variants = <T extends object>(...variants: [string, AnyField][]): Field<T> => {

  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i]
    if (!(
      (variants[i] instanceof Array) &&
      (variants[i].length === 2) &&
      (typeof variants[i][0] === 'string') &&
      (!!variants[i][1]) &&
      (typeof variants[i][1] === 'object') &&
      (typeof variants[i][1].encode === 'function') &&
      (typeof variants[i][1].decode === 'function')
    )) {
      throw new Error(
        `struct fields #${i} must look like: ["name", { encode(), decode() }]`
      )
    }
  }

  return {

    encode (buffer: Writer, value: T) {
      const [valueKey, valueData] = variant<T, keyof T>(value)

      for (let i = 0; i < variants.length; i++) {
        const [key, field] = variants[i]
        if (key === valueKey) {
          buffer.writeNumber(i, 'u8')
          return field.encode(buffer, valueData)
        }
      }

      const keys = variants.map(v=>v[0]).join('|')
      throw new Error(`Variant "${String(valueKey)}" not found in enum. Valid are ${keys}`)
    },

    decode (buffer: Reader): T {
      const index = Number(buffer.readNumber('u8'))
      if (index > variants.length) {
        throw new Error(`enum option ${index} is not available`);
      }
      const [key, field] = variants[index]
      try {
        return { [key]: field.decode(buffer) } as T
      } catch (e) {
        ;(e as any).structPath ??= []
        ;(e as any).structPath.unshift(`/${key}`)
        throw e
      }
    }

  }

}

export function variant <T extends object, K extends keyof T> (object: T): [K, T[K]] {
  const keys = Object.keys(object) as K[]
  if (keys.length !== 1) {
    throw new Error('enum variant should have exactly 1 key')
  }
  return [keys[0], object[keys[0]]]
}

export const string: Field<string> = {

  encode (buffer: Writer, value: string) {
    const _value = value as string;
    // encode to utf8 bytes without using TextEncoder
    const utf8Bytes: number[] = [];
    for (let i = 0; i < _value.length; i++) {
      let charCode = _value.charCodeAt(i);
      if (charCode < 0x80) {
        utf8Bytes.push(charCode);
      } else if (charCode < 0x800) {
        utf8Bytes.push(0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f));
      } else if (charCode < 0xd800 || charCode >= 0xe000) {
        utf8Bytes.push(0xe0 | (charCode >> 12), 0x80 | ((charCode >> 6) & 0x3f), 0x80 | (charCode & 0x3f));
      } else {
        i++;
        charCode = 0x10000 + (((charCode & 0x3ff) << 10) | (_value.charCodeAt(i) & 0x3ff));
        utf8Bytes.push(
          0xf0 | (charCode >> 18),
          0x80 | ((charCode >> 12) & 0x3f),
          0x80 | ((charCode >> 6) & 0x3f),
          0x80 | (charCode & 0x3f),
        );
      }
    }
    // 4 bytes for length + string bytes
    buffer.writeNumber(utf8Bytes.length, 'u32');
    buffer.write(new Uint8Array(utf8Bytes));
  },

  decode (buffer: Reader): string {
    const len: number = buffer.readNumber('u32') as number;
    const buf = new Uint8Array(buffer.read(len));
    // decode utf-8 string without using TextDecoder
    // first get all bytes to single byte code points
    const codePoints = [];
    for (let i = 0; i < len; ++i) {
      const byte = buf[i];
      if (byte < 0x80) {
        codePoints.push(byte);
      } else if (byte < 0xE0) {
        codePoints.push(
          ((byte & 0x1F) << 6) | (buf[++i] & 0x3F)
        );
      } else if (byte < 0xF0) {
        codePoints.push(
          ((byte & 0x0F) << 12) | ((buf[++i] & 0x3F) << 6) | (buf[++i] & 0x3F)
        );
      } else {
        codePoints.push(
          ((byte & 0x07) << 18) | ((buf[++i] & 0x3F) << 12) | ((buf[++i] & 0x3F) << 6) | (buf[++i] & 0x3F)
        );
      }
    }
    // then decode code points to utf-8
    return String.fromCodePoint(...codePoints);
  }

}

/** An unsigned integer. */
export const unsigned = (bytes: number): Field<bigint> => {
  if (nativeInts.includes(bytes)) {
    const typeHint = `u${bytes*8}`
    return {
      encode (buffer: Writer, value: bigint) {
        return buffer.writeNumber(value, typeHint)
      },
      decode (buffer: Reader): bigint {
        return BigInt(buffer.readNumber(typeHint))
      },
    }
  }

  return {
    encode (buffer: Writer, value: bigint) {
      const chunk = new Uint8Array(bytes);
      for (let i = 0; i < bytes; i++) {
        ;(buffer as unknown as Array<number>)[i] = Number(value & 0xFFn);
        value = value >> 8n;
      }
      buffer.write(chunk)
    },
    decode (buffer: Reader): bigint {
      const chunk = new Uint8Array(buffer.read(bytes))
      let number = 0n
      for (let i = bytes - 1; i >= 0; i--) {
        number = number << 8n
        number = number + BigInt(chunk[i])
      }
      return number
    },
  }
}

/** A signed integer. */
export const signed = (size: number): Field<bigint> => {
  if (nativeInts.includes(size)) {
    const typeHint = `i${size*8}`
    return {
      encode (buffer: Writer, value: bigint) {
        return buffer.writeNumber(value, typeHint)
      },
      decode (buffer: Reader): bigint {
        return BigInt(buffer.readNumber(typeHint))
      },
    }
  }

  const sizes = nativeInts.join('|')
  return {
    encode (buffer: Writer, value: bigint) {
      throw new Error(`todo: encode signed of size other than ${sizes}`)
    },
    decode (buffer: Reader): bigint {
      throw new Error(`todo: decode signed of size other than ${sizes}`)
    },
  }

}

export const float = (size: number): Field<number> => {
  if (nativeFloats.includes(size)) {
    const typeHint = `f${size*8}`
    return {
      encode (buffer: Writer, value: number) {
        return buffer.writeNumber(value, typeHint)
      },
      decode (buffer: Reader): number {
        return buffer.readNumber(typeHint) as number
      },
    }
  }

  const sizes = nativeFloats.join('|')
  return {
    encode (buffer: Writer, value: number) {
      throw new Error(`todo: encode float of size other than ${sizes}`)
    },
    decode (buffer: Reader): number {
      throw new Error(`todo: decode float of size other than ${sizes}`)
    },
  }

}

/** An 8-bit unsigned integer. */
export const u8   = unsigned(1)
/** A 16-bit unsigned integer. */
export const u16  = unsigned(2)
/** A 32-bit unsigned integer. */
export const u32  = unsigned(4)
/** A 64-bit unsigned integer. */
export const u64  = unsigned(8)
/** A 128-bit unsigned integer. */
export const u128 = unsigned(16)
/** A 256-bit unsigned integer. */
export const u256 = unsigned(32)

/** An 8-bit signed integer. */
export const i8   = signed(1)
/** A 16-bit signed integer. */
export const i16  = signed(2)
/** A 32-bit signed integer. */
export const i32  = signed(4)
/** A 64-bit signed integer. */
export const i64  = signed(8)
/** A 128-bit signed integer. */
export const i128 = signed(16)
/** A 256-bit signed integer. */
export const i256 = signed(32)

/** A 32-bit floating point number. */
export const f32 = () => float(4)
/** A 64-bit floating point number. */
export const f64 = () => float(16)

/** A Zcash compact integer. */
export const compact: Field<bigint> = {

  encode (buffer: Writer, value: number|bigint) {
    throw new Error('encode CompactSize: not implemented')
  },

  decode (buffer: Reader): bigint {
    let flag = buffer.readNumber('u8')
    let result: bigint

    if (flag < 253n) {
      result = BigInt(flag)

    } else if (flag === 253n) {
      let pole = buffer.readNumber('u16')
      if (pole < 253n) {
        throw new Error('non-canonical CompactSize')
      }
      result = BigInt(pole)

    } else if (flag == 254n) {
      let pole = buffer.readNumber('u32')
      if (pole < 0x10000n) {
        throw new Error('non-canonical CompactSize')
      }
      result = BigInt(pole)

    } else {
      let pole = buffer.readNumber('u64')
      if (pole < 0x100000000n) {
        throw new Error('non-canonical CompactSize')
      }
      result = BigInt(pole)
    }

    if (result > 0x02000000n) {
      throw new Error('CompactSize too large')
    }

    return result
  }

}

/** A structure with pre-defined fields of various types. */
export const struct = <T>(...fields: [string, AnyField][]): Field<T> => {

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i]
    if (!(
      (fields[i] instanceof Array) &&
      (fields[i].length === 2) &&
      (typeof fields[i][0] === 'string') &&
      (!!fields[i][1]) &&
      (typeof fields[i][1] === 'object') &&
      (typeof fields[i][1].encode === 'function') &&
      (typeof fields[i][1].decode === 'function')
    )) {
      throw new Error(
        `struct field #${i} must look like: ["name", { encode(), decode() }], found: ${field}`
      )
    }
  }

  return {

    encode (buffer: Writer, value: T) {
      for (const [key, element] of fields) {
        element.encode(buffer, value[key as keyof T])
      }
    },

    decode (buffer: Reader): T {
      const result: Partial<T> = {};
      for (const [key, element] of fields) {
        try {
          result[key as keyof typeof result] = element.decode(buffer) as typeof result[keyof T]
        } catch (e) {
          ;(e as any).structPath ??= []
          ;(e as any).structPath.unshift(key)
          throw e
        }
      }
      return result as T
    }

  }

}

export type Fields = [string, AnyField][]

export function encode <T> (schema: Field<T>, decoded: T): Uint8Array {
  const writer = new Writer()
  schema.encode(writer, decoded)
  return new Uint8Array(writer.buffer)
}

export function decode <T> (schema: Field<T>, encoded: Uint8Array|Array<number>): T {
  if (!(encoded instanceof Uint8Array)) encoded = new Uint8Array(encoded)
  return schema.decode(new Reader(encoded))
}

export function Struct (...fields: [string, AnyField][]) {
  const schema = struct(...fields)
  return class Struct {
    static decode (encoded: Uint8Array) {
      return new this(decode(schema, encoded) as Record<string, unknown>)
    }
    constructor (data: Record<string, unknown>) {
      for (const [key, _] of fields) {
        Object.assign(this, { [key]: data[key] })
      }
    }
  }
}
