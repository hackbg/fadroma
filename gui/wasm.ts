/* Importing this module fetches and initializes the app's WASM component. */
import { Wasm } from '../platform/SimplicityHL/SimplicityHL.ts';
const wasm = new URL('/wasm/fadroma_simf_bg.wasm', location.href);
const wrap = new URL('/wasm/fadroma_simf.js',      location.href);
console.debug(`Loading WASM from ${wasm} + ${wrap}`);
export default await Wasm({ wasm, wrap }) as Wasm;
console.debug(`Loaded WASM`)
