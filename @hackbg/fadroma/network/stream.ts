import type { Bytes, Step } from '../index.ts';
import { reflect, pipe, identity } from '../call.ts';
import { concatBytes } from '../format/bytes.ts';

/** Connection to `Read & Write` pair. */
export type RW<T = Bytes> = Reader<T> & Writer<T> & { close?: () => unknown };
/** Convert owner of `readable & writable` to `Read & Write` pair. */
export function toRW <T> (state): RW<T> {
  const {
    name = null,
    close,
    readable,
    onRead = identity,
    writable,
    onWrite = identity,
  } = state;
  return Object.assign(state, {
    read:  toRead({ name, readable },  onRead)  as Read<T>,
    write: toWrite({ name, writable }, onWrite) as Write<T>,
    close,
  });
};

/** Input stream reader. */
export type Reader<T = Bytes> = { read: Read<T> };
/** Read from stream. */
export type Read<T = Bytes> = () => Promise<{ done: boolean, value: T }>;
/** Convert the owner of a `readable` to a `Read` function. */
export function toRead <T> ({ name = null, readable }, ...steps: Step<T>[]): Read<T> {
  const pipeline = pipe(...steps);
  const reader = readable.getReader();
  return reflect(name ? `${name}>` : 'read', function read (
    ...args: Parameters<typeof reader["read"]>
  ) {
    return pipeline(reader.read(...args));
  }, { name, readable, reader, pipeline });
};

/** Output stream writer. */
export type Writer<T = Bytes> = { write: Write<T> };
/** Write to stream. */
export type Write<T = Bytes> = (_: T) => Promise<void>;
/** Convert the owner of a `writable` to a `Write` function. */
export function toWrite <T> ({ name = null, writable }, ...steps: Step<T>[]): Write<T> {
  const pipeline = pipe(...steps);
  const writer = writable.getWriter();
  return reflect(name ? `${name}<` : 'write', function write (
    ...args: Parameters<typeof writer["write"]>
  ) {
    return writer.write(pipeline(...args));
  }, { name, writable, writer, pipeline });
};

/** Specify write target. */
export const writeTo = <T>(output: Writer<T>, ...prefix: T[]) =>
  async (...data: T[]) => {
    for (const datum of prefix) await output.write(datum);
    for (const datum of data) await output.write(datum);
  };
/** Specify write operation. */
export const write = <T>(...data: T[]) =>
  async (writer: Writer<T>) => {
    for (const datum of data) await writer.write(datum);
    return writer
  }
/** Read between `min` and `max` bytes. */
export const readBytes = ({ min = 0, max = 256 } = {}) =>
  reflect(`read between ${min} and ${max} bytes`,
    async function readSomeBytes ({ read }: Reader<Bytes>) {
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
export async function readUntilDone ({ read }: Reader<Bytes>): Promise<Bytes|null> {
  const chunks = [];
  while (true) {
    const { done, value } = await read()
    chunks.push(value);
    if (done) break;
  }
  if (chunks.length === 0) return null
  const result = concatBytes(chunks)
  return result
}
