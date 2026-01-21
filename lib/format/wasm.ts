import { readFile } from 'node:fs/promises';
export function wasmLoader <T> (
  wasmUrl: string|URL,
  wrapUrl: string|URL,
): () => Promise<T> {
  let ready: Promise<T>;
  wasmUrl = new URL(wasmUrl);
  wrapUrl = new URL(wrapUrl);
  ready ??= new Promise(async (resolve, reject)=>{
    try {
      const wrap = await import(wrapUrl);
      const wasm = await readFile(wasmUrl);
      await wrap.default(wasm);
      resolve(wrap);
    } catch (e) {
      ready = null;
      reject(e);
    }
  });
  return () => ready
}

