import Html from '../library/Html.ts';
import Bitcoin from '../platform/Bitcoin/Bitcoin.ts';
let chain = null;
export default function Chain () {
  const el = Html(['button.chain', chain?.status ?? 'Connecting...']);
  chain ??= Bitcoin.Connect('https://liquidtestnet.com').then(connection => {
    chain = connection;
  }).catch(e => {
    chain = { status: e.message }
  });
  return el
}
