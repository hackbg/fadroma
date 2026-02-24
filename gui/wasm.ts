/* Importing this module fetches and initializes the app's WASM component. */
import { Wasm } from '../platform/SimplicityHL/SimplicityHL.ts';
const wasmUrl = new URL('/wasm/fadroma_simf_bg.wasm', location.href);
const wrapUrl = new URL('/wasm/fadroma_simf.js',      location.href);
console.debug(`Loading WASM from ${wasmUrl} + ${wrapUrl}`);
export default await Wasm(wasmUrl, wrapUrl);
console.debug(`Loaded WASM`)
