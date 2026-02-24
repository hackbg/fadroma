import Html from '../library/Html.ts';
import { Base16 } from '../library/Number.ts';
export default Select;

function Select () { /* TODO */ }

namespace Select {

  export interface Update {
    update (_: Partial<this>): this
  }

  export interface WithInput extends Update {
    name:   string,
    view:   DocumentFragment,
    select: HTMLSelectElement,
    input:  HTMLInputElement,
  }

  export interface Pubkey extends Select.WithInput {}

  export function Pubkey ({
    name   = null as string,
    update = (state: Select.Pubkey) => { state.input.value = state.select.value; return state },
    view   = Html(['label', ['em', name], ['div.row.gap', ['select.pick-user'], ['input.pubkey']]]),
    select = view.querySelector('select'),
    input  = view.querySelector('input'),
  }: Partial<Select.Pubkey> = {}): Select.Pubkey {
    const state = { name, view, select, input, update };
    select.onchange = () => update(state);
    return update(state);
  }

  export interface Signer extends Select.WithInput {}

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

  export const Chain     = () => ['label', ['strong', 'Chain:'],     ['select.pick-chain',   ['option', 'liquidtestnet']]];
  export const Program   = () => ['label', ['strong', 'Program:'],   ['select.pick-program', ['option', 'P2PK']]];
  export const Sender    = () => ['label', ['strong', 'Sender:'],    ['select.pick-user',    ['option', 'Alice']]]; 
  export const Recipient = () => ['label', ['strong', 'Recipient:'], ['select.pick-user']]
}
