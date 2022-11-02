import { sha256, base16 } from '@hackbg/formati'
import type { Address } from '@fadroma/client'

declare class TextDecoder { decode (data: any): string }

declare class TextEncoder { encode (data: string): any }

export type ErrCode = number

export type Ptr     = number

export type Size    = number

/** Memory region as allocated by CosmWasm */
export type Region = [Ptr, Size, Size, Uint32Array?]

/** Heap with allocator for talking to WASM-land */
export interface IOExports {
  memory:                           WebAssembly.Memory
  allocate    (len: Size):          Ptr
  deallocate? (ptr: Ptr):           void
}

export const ADDRESS_PREFIX = 'mocked'

export const codeHashForBlob = (blob: Uint8Array) => base16.encode(sha256(blob))

const decoder = new TextDecoder()

const encoder = new TextEncoder()

export function parseResult (
  response: { Ok: any, Err: any },
  action:   'instantiate'|'execute'|'query'|'query_chain',
  address?: Address
) {
  const { Ok, Err } = response
  if (Err !== undefined) {
    const errData = JSON.stringify(Err)
    const message = `Mocknet ${action}: contract ${address} returned Err: ${errData}`
    throw Object.assign(new Error(message), Err)
  }
  if (Ok !== undefined) {
    return Ok
  }
  throw new Error(`Mocknet ${action}: contract ${address} returned non-Result type`)
}

/** Read region properties from pointer to region. */
export function region (buffer: any, ptr: Ptr): Region {
  const u32a = new Uint32Array(buffer)
  const addr = u32a[ptr/4+0] // Region.offset
  const size = u32a[ptr/4+1] // Region.capacity
  const used = u32a[ptr/4+2] // Region.length
  return [addr, size, used, u32a]
}

/** Read contents of region referenced by region pointer into a string. */
export function readUtf8 (exports: IOExports, ptr: Ptr): string {
  const { buffer } = exports.memory
  const [addr, size, used] = region(buffer, ptr)
  const u8a  = new Uint8Array(buffer)
  const view = new DataView(buffer, addr, used)
  const data = decoder.decode(view)
  drop(exports, ptr)
  return data
}

/** Read contents of region referenced by region pointer into a string. */
export function readBuffer (exports: IOExports, ptr: Ptr): Buffer {
  const { buffer } = exports.memory
  const [addr, size, used] = region(buffer, ptr)
  const u8a  = new Uint8Array(buffer)
  const output = Buffer.alloc(size)
  for (let i = addr; i < addr + size; i++) {
    output[i - addr] = u8a[i]
  }
  return output
}

/** Serialize a datum into a JSON string and pass it into the contract. */
export function pass <T> (exports: IOExports, data: T): Ptr {
  return passBuffer(exports, utf8toBuffer(JSON.stringify(data)))
}

/** Allocate region, write data to it, and return the pointer.
  * See: https://github.com/KhronosGroup/KTX-Software/issues/371#issuecomment-822299324 */
export function passBuffer (exports: IOExports, buf: Buffer): Ptr {
  const ptr = exports.allocate(buf.length)
  const { buffer } = exports.memory // must be after allocation - see [1]
  const [ addr, _, __, u32a ] = region(buffer, ptr)
  u32a![ptr/4+2] = u32a![ptr/4+1] // set length to capacity
  write(buffer, addr, buf)
  return ptr
}

/** Write data to memory address. */
export function write (buffer: any, addr: number, data: ArrayLike<number>): void {
  new Uint8Array(buffer).set(data, addr)
}

/** Write UTF8-encoded data to memory address. */
export function writeUtf8 (buffer: any, addr: number, data: string): void {
  new Uint8Array(buffer).set(encoder.encode(data), addr)
}

/** Write data to address of region referenced by pointer. */
export function writeToRegion (exports: IOExports, ptr: Ptr, data: ArrayLike<number>): void {
  const [addr, size, _, u32a] = region(exports.memory.buffer, ptr)
  if (data.length > size) { // if data length > Region.capacity
    throw new Error(`Mocknet: tried to write ${data.length} bytes to region of ${size} bytes`)
  }
  const usedPtr = ptr/4+2
  u32a![usedPtr] = data.length // set Region.length
  write(exports.memory.buffer, addr, data)
}

/** Write UTF8-encoded data to address of region referenced by pointer. */
export function writeToRegionUtf8 (exports: IOExports, ptr: Ptr, data: string): void {
  writeToRegion(exports, ptr, encoder.encode(data))
}

/** Deallocate memory. Fails silently if no deallocate callback is exposed by the blob. */
export function drop (exports: IOExports, ptr: Ptr): void {
  if (exports.deallocate) {
    exports.deallocate(ptr)
  } else {
    //log.warn("Can't deallocate", ptr)
  }
}

/** Convert base64 to string */
export function b64toUtf8 (str: string) {
  return Buffer.from(str, 'base64').toString('utf8')
}

/** Convert string to base64 */
export function utf8toB64 (str: string) {
  return Buffer.from(str, 'utf8').toString('base64')
}

export function utf8toBuffer (str: string) {
  return Buffer.from(str, 'utf8')
}

export function bufferToUtf8 (buf: Buffer) {
  return buf.toString('utf8')
}

