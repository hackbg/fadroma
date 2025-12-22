export function wasmLoader <T> (
  wasmPath: string,
  wrapPath: string,
): () => Promise<T> {
  let ready: Promise<T>
  ready ??= new Promise(async (resolve, reject)=>{
    try {
      const wrap = await import(wrapPath);
      const wasm = await Deno.readFile(wasmPath);
      await wrap.default(wasm);
      resolve(wrap);
    } catch (e) {
      ready = null;
      reject(e);
    }
  });
  return () => ready
}

