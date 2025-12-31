import Fn from './function.ts';
import { Bytes } from './byte.ts';

/** Connection to `Read & Write` pair. */
export type RW<T = Bytes> = Reader<T> & Writer<T> & { close?: () => unknown };
/** Convert owner of `readable & writable` to `Read & Write` pair. */
export function toRW <T> (state): RW<T> {
  const {
    name = null,
    close,
    readable,
    onRead = Fn.Id,
    writable,
    onWrite = Fn.Id,
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
  const pipeline = Fn.Pipe(...steps);
  const reader = readable.getReader();
  return Fn.Name(name ? `${name}>` : 'read', async function read () {
    return pipeline(await reader.read()) as { done: boolean, value: T };
  }, { name, readable, reader, pipeline });
};

/** Output stream writer. */
export type Writer<T = Bytes> = { write: Write<T> };
/** Write to stream. */
export type Write<T = Bytes> = (_: T) => Promise<void>;
/** Convert the owner of a `writable` to a `Write` function. */
export function toWrite <T> ({ name = null, writable }, ...steps: Step<T>[]): Write<T> {
  const pipeline = Fn.Pipe(...steps);
  const writer = writable.getWriter();
  return Fn.Name(name ? `${name}<` : 'write', function write (
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
  Fn.Name(`read between ${min} and ${max} bytes`,
    async function readSomeBytes (reader: Reader<Bytes>) {
      let total = 0;
      const chunks = []
      while (true) {
        const { done, value } = await reader.read() || { done: true };
        chunks.push(value);
        total += value?.length ?? 0;
        if (done || (total >= max)) break;
      }
      return Bytes.concat(chunks)
    }, { min, max });

/** Read whole stream. */
export async function readUntilDone (reader: Reader<Bytes>): Promise<Bytes|null> {
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read() || { done: true };
    chunks.push(value);
    if (done) break;
  }
  if (chunks.length === 0) return null
  const result = Bytes.concat(chunks)
  return result
}
