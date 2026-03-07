import { Fn, Http } from '../../library/index.ts';

export default BtcRest;

interface BtcRest {
  chaininfo: Fn,
  block:     Fn,
  tx:        Fn<[string, "json"?], Promise<BtcRest.Tx>>,
}

/** Bitcoin node's optional REST API. */
function BtcRest (url: string): BtcRest {
  return {
    async chaininfo (format = "json") {
      let data = await Http.fetchText(`${url}/rest/chaininfo.${format}`);
      if (format === 'json') data = JSON.parse(data);
      return data;
    },
    async block (hash: string, format = "json") {
      let data = await Http.fetchText(`${url}/rest/block/${hash}.${format}`);
      if (format === 'json') data = JSON.parse(data);
      return data;
    },
    async tx (hash: string, format = "json" as const) {
      let data = await Http.fetchText(`${url}/rest/tx/${hash}.${format}`);
      if (format === 'json') data = JSON.parse(data);
      return data as unknown as BtcRest.Tx;
    },
    async utxos (utxos: [string, number][], format = "json" as const) {
      let data = await Http.fetchText(`${url}/rest/getutxos/${utxos.map(x=>x.join('-')).join('/')}.${format}`);
      if (format === 'json') data = JSON.parse(data);
      return data
    }
  }
}

namespace BtcRest {
  export interface Tx {
    hex:       string,
    txid:      string,
    blockhash: string,
    vout:      Vout[]
  }
  export interface Vout {
    value: number,
    scriptPubKey: {
      type:    string,
      address: string
    }
  }
}
