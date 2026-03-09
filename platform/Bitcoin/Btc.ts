import type { Log } from '../../library/index.ts';
import BtcRpc  from './BtcRpc.ts';
import BtcRest from './BtcRest.ts';
import Esplora from './Esplora.ts';

/** Merged export. */
export default BtcConnect;

/** A Bitcoin or Elements connection. */
interface BtcConnect extends Log {
  url?:     string,
  rpc?:     BtcRpc,
  rest?:    BtcRest,
  esplora?: Esplora,
};

/** Connect to Bitcoin via RPC, REST, and/or Esplora. */
function BtcConnect <T extends BtcConnect> (options?: string|BtcConnect.Options): T {
  // Support connecting from string (url)
  if (typeof options === 'string') options = { rpc: options, rest: options };
  // No partially mutable bindings in JS :(
  const { rpc, rest, esplora, ...context } = options || {};
  // Initialize the API callers that constitute the chain connection.
  return {
    ...context,
    rpc:     (typeof rpc     === 'string') ? BtcRpc(rpc)               : rpc,
    rest:    (typeof rest    === 'string') ? BtcRest(rest)             : rest,
    esplora: (typeof esplora === 'string') ? Esplora({ url: esplora }) : esplora
  } as T;
}

/** Bitcoin internals. */
namespace BtcConnect {
  /** Bitcoin connection options. */
  export type Options = Partial<Log> & {
    rpc?:     string|BtcRpc,
    rest?:    string|BtcRest,
    esplora?: string|Esplora,
  };
}
