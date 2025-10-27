import type { Bytes } from '../index.ts';
import { reflect } from '../call.ts';
import { concatBytes } from '../format/bytes.ts';
/** Simplified bidirectional stream interface. */
export type RW<T = Bytes> = Reader<T> & Writer<T>;
/** Input stream reader. */
export type Reader<T = Bytes> = { read: Read<T> };
/** Output stream writer. */
export type Writer<T = Bytes> = { write: Write<T> };
/** Write to stream. */
export type Write<T = Bytes> = (_: T) => Promise<void>;
/** Read from stream. */
export type Read<T = Bytes> = () => Promise<{ done: boolean, value: T }>;
/** Convert pair of streams to simplified form. */
export const toRW = ({ readable, writable }) => {
  const reader = readable.getReader();
  const writer = writable.getWriter();
  return {
    read: Object.assign(function read () { return reader.read() }, {
      readable, reader
    }),
    write: Object.assign(function write (x: Bytes) { return writer.write(x) }, {
      writable, writer
    }),
  };
};
/** Define a data write operation. */
export const writeTo = <T>(output: Writer<T>, ...prefix: T[]) =>
  async (...data: T[]) => {
    for (const datum of prefix) await output.write(datum);
    for (const datum of data) await output.write(datum);
  };
/** Write some data to a target that will be passed later. */
export const write = <T>(...data: T[]) =>
  async (output: Writer<T>) => {
    for (const datum of data) await output.write(datum);
  }
/** Read between `min` and `max` bytes. */
export const readBytes = ({ min = 0, max = 256 } = {}) =>
  reflect(`read between ${min} and ${max} bytes`,
    async function readSomeBytes (read: Read<Bytes>) {
      let total = 0;
      const chunks = []
      while (true) {
        const { done, value } = await read();
        chunks.push(value);
        total += value?.length ?? 0;
        if (done || (total >= max)) break;
      }
      return concatBytes(chunks)
    }, { min, max });
/** Read whole stream. */
export async function readUntilDone (read: Read<Bytes>): Promise<Bytes> {
  const chunks = [];
  while (true) {
    const { done, value } = await read()
    chunks.push(value);
    if (done) break;
  }
  const result = concatBytes(chunks)
  return result
}
