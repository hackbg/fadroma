import Bitcoin from '../platform/Bitcoin/Bitcoin.ts';
import Html from '../library/Html.ts';
import { Base16 } from '../library/Number.ts';
export default Select;

function Select () { /* TODO */ }

namespace Select {

  export const Chain     = () => ['label', ['strong', 'Chain:'],     ['select.pick-chain',   ['option', 'liquidtestnet']]];
  export const Program   = () => ['label', ['strong', 'Program:'],   ['select.pick-program', ['option', 'P2PK']]];
  export const Recipient = () => ['label', ['strong', 'Recipient:'], ['select.pick-user']]

  export interface Update {
    update (_: Partial<this>): this
  }

  export interface WithInput extends Update {
    name:   string,
    view:   DocumentFragment,
    select: HTMLSelectElement,
    input:  HTMLInputElement,
  }

  export interface Sender extends Select.WithInput {}
  export interface Pubkey extends Select.WithInput {}
  export interface Signer extends Select.WithInput {}

  export function Pubkey ({
    name   = null as string,
    view   = Html(['label.col.gap', { style: 'align-items:stretch' }, ['div.row.gap', ['em.grow', name], ['select.pick-user']], ['input.pubkey']]),
    select = view.querySelector('select'),
    input  = view.querySelector('input'),
    update = (state: Select.Pubkey) => { state.input.value = state.select.value; return state },
  }: Partial<Select.Pubkey> = {}): Select.Pubkey {
    const state = { name, view, select, input, update };
    select.onchange = () => update(state);
    return update(state);
  }

  export function Sender ({
    name   = 'Sender:',
    view   = Html(['label.col.gap', { style: 'align-items:stretch' }, ['div.row.gap', ['string.grow', name], ['select.pick-user']], ['div.row.gap', ['strong.grow', 'Balance:'], ['input.balance.grow', { disabled: true }], 'sats']]).firstChild,
    select = view.querySelector('select'),
    input  = view.querySelector('input'),
    update = (state: Select.Sender) => { setTimeout(()=>updateSenderBalance(state), 1); return state },
  }: Partial<Select.Sender> = {}): Select.Sender {
    const state = { name, view, select, input, update };
    select.onchange = () => update(state);
    return update(state);
  }

  async function updateSenderBalance ({
    select,
    input,
    chain = Bitcoin.LiquidTestnet(),
    asset = "38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5",
  }) {
    const pubkey = select.value;
    const sender = (await import('./Simf.ts')).usersByPubkey[pubkey];
    const utxos  = await Bitcoin.LiquidTestnet().esplora.getAddressUtxos(sender.p2wpkh) as unknown[];
    let balance  = 0n;
    for (const utxo of utxos) if (utxo.asset === asset) balance += BigInt(utxo.value)
    input.value = String(balance)
  }

  export function Signer ({
    name   = null as string,
    update = (state: Select.Pubkey) => { console.error('Select.Signer: provide sighash first!'); return state },
    view   = Html(['label', ['em', name], ['div.row.gap', ['select.pick-user'], ['input.signed']]]),
    select = Object.assign(view.querySelector('select'), { onchange: update }),
    input  = view.querySelector('input')
  }: Partial<Select.Signer> = {}) {
    return update({ name, view, select, input, update });
  }

  export function findUserPickers (): HTMLSelectElement[] {
    return document.querySelectorAll('select.pick-user') as unknown as HTMLSelectElement[]
  }

  export function initUserPicker (
    select: HTMLSelectElement, users: { name: string, p2wpkh: string, pubkey: string }[]
  ) {
    select.innerHTML = '';
    for (const user of users) {
      const label = `${user.name} (${user.p2wpkh.slice(0, 10)}...)`
      select.appendChild(Html(['option', { value: Base16.encode(user.pubkey) }, label]));
    }
    if (select.onchange) select.onchange(null);
  }

  export const License = () => [
    'select#licence', // Free software licensing helps the software stay free.
    ['option', 'AGPL 3.0 or later'],
    ['option', 'AGPL 3.0 only'],
    ['option', 'GPL 3.0 or later'],
    ['option', 'GPL 3.0 only'],
    ['option', 'Closed source (inquire)']];

}
