export function Namada () {}

export interface Namada () {}

export namespace Namada () {}

/** Namada WASM-based decoder. */
Namada.Wasm = async function loadNamadaWasm (
  decoder: string|URL|Uint8Array
): Promise<Decoder> {
  const { default: init, Decode } = await import('./namada/pkg/fadroma_namada.js');
  if (decoder instanceof Uint8Array) {
    await init(decoder)
  } else if (decoder) {
    await init(await fetch(decoder))
  } else {
    throw new Error('Provide decoder as path, URL or Uint8Array')
  }
  Namada.Wasm = async () => Decode as unknown as Decoder;
  return Decode as unknown as Decoder;
}
