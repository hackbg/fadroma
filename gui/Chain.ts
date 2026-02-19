import Html from '../library/Html.ts';
import Bitcoin from '../platform/Bitcoin/Bitcoin.ts';
let chain = null;
export default function Chain () {
  const el = Html(['button.chain', chain ? 'Connecting...' : 'Connected!']);
  chain ??= Bitcoin.LiquidTestnet();
  console.log(chain);
  chain.rpc.getbestblockhash().then(console.log).catch(console.error);
  el.firstChild.innerText = 'Connected!';
  return el
}
