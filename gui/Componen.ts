import Html from '../library/Html.ts';
import Bitcoin from '../platform/Bitcoin/Bitcoin.ts';
import { Base16 } from '../library/Number.ts';
import { elById } from './lib.ts';

export function Button () { /* TODO */ }

export namespace Button {

  export function Command (icon: string|null, ...content: unknown[]) {
    return [ 'div.command', icon && Icon(icon), ...content ]
  }

  export function Compile ({
    label   = Html(['strong', 'Program address:']),
    button  = Html(['button', 'Compile', { style: 'padding:0 1rem; border: 1px solid #af48' }]),
    input   = Html(['input']),
    view    = Html(['label', label, ['div.row.gap', button, input]]).firstChild,
    chain   = Bitcoin.LiquidTestnet,
    genesis = 'a771da8e52ee6ad581ed1e9a99825e5b3b7992225534eaa2ae23244fe26ab1c1',
  } = {}) {
    view.querySelector('button').onclick = compile;
    return { view, compile }
    async function compile () {
      const { default: Wasm } = await import('./Wasm.ts');
      const compiler = Wasm.compiler({ chain: chain.ID, genesis });
      const program = compiler.compile(`fn main () {}`);
      const address = program.toJSON().p2tr;
      view.querySelector('input').value = address;
      document.querySelector('#simf-redeem .balance').value = String(await getBalances(address))
    }
  }

  export function Commit ({
    view    = Html(['label', ['strong', 'Commit TX:'], ['button', 'Commit']]).firstChild,
    chain   = Bitcoin.LiquidTestnet,
    genesis = 'a771da8e52ee6ad581ed1e9a99825e5b3b7992225534eaa2ae23244fe26ab1c1',
  } = {}) {
    view.querySelector('button').onclick = commit;
    return { view, commit }
    async function commit () {
      const { default: Wasm } = await import('./Wasm.ts');
      const compiler = Wasm.compiler({ chain: chain.ID, genesis });
      const program = compiler.compile(`fn main () {}`);
      const pubkey = document.getElementById('select-sender').value;
      const { usersByPubkey } = await import('./Simf.ts');
      const sender = usersByPubkey[pubkey];
      if (!sender) throw new Error(`not our pubkey: ${sender}`);
      const utxos = await chain().esplora.getAddressUtxos(sender.p2wpkh) as unknown[];
      if (utxos.length < 1) throw new Error(`fund the address first: ${sender.p2wpkh}`)
    }
  }

}

export function Field (id: string, { open = false, header = [], content = [] } = {}) {
  return {
    id,
    open:    bool => Field(id, { open: bool, header, content }),
    header:  item => Field(id, { open, header: [...header, item], content  }),
    content: item => Field(id, { open, header, content: [...content, item] }),
    build:   () => Field.Wrapper(id, !open, Field.Handle(id, !open),
      ['div.flex.col.grow', Field.Header(id, ...header), ...content]),
  }
}

export namespace Field {


  export const Wrapper = (id: string, collapsed: boolean, ...rest: unknown[]) =>
    ([`div.field.file${collapsed?'.collapsed':''}#${id}[data-path=${id}]`, ...rest]);

  export const Handle = (id: string, collapsed: boolean) =>
    (['div.handle-v', Field.toggle(id), Field.Icon(collapsed), ['div.grow']]);

  export const Icon = (collapsed: boolean) =>
    (['svg.icon', [`use[href=${'icons.svg#'+(collapsed?'chevron-right':'chevron-down')}]`]]);

  export const Header = (id: string, ...header: unknown[]) =>
    (['div.flex.row.align-center',
      ['div.name', Field.toggle(id), id],
      ['div.handle-h', Field.toggle(id)],
      ...header]);

  export const toggle = (id: string) => ({
    onclick: () => {
      const el = elById(id);
      console.log({id, el});
      const icon = el.querySelector('.icon') as SVGUseElement;
      el.classList.toggle('collapsed');
      if (el.classList.contains('collapsed')) {
        (icon.firstChild as SVGUseElement).href.baseVal = 'icons.svg#chevron-right';
      } else {
        (icon.firstChild as SVGUseElement).href.baseVal = 'icons.svg#chevron-down';
        const textarea = el.querySelector('textarea');
        if (textarea) {
          textarea.focus();
          Field.computeHeight(textarea);
        }
      }
    }
  });
  export const computeHeight = (textarea: HTMLTextAreaElement) => {
    textarea.style.height ||= `${1.5*(1+Math.max(2, textarea.value.split('\n').length))}em`;
  };

  export function TextArea (id: string, ...content: string[]) {
    return [`textarea.collapsible#text:${id}`,
      {autocomplete: "off", autocorrect: "off", autocapitalize: "off", spellcheck: false},
      content.filter(x=>typeof x === 'string').join('\n')];
  }

  export const Text = (id: string, ...content: string[]) =>
    Field(id).content(TextArea(id, ...content)).build();

  export const Hex = (id: string, ...content: unknown[]) =>
    Html([`div.field.file.hex#${id}`,
      ['div.handle-v', { onclick: Field.toggle(id) },
        ['svg.icon.expanded', ['use[href=icons.svg#chevron-down]']],
        ['div.grow']],
      ['div.flex.col.grow',
        ['div.flex.row',
          ['div.name',     { onclick: Field.toggle(id) }, id],
          ['div.handle-h', { onclick: Field.toggle(id) }]],
        HexRow('00000000 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
        HexRow('00000010 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
        HexRow('00000020 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
        HexRow('00000030 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................')]]);

  export const HexRow = (addr, bytes, chars) => ['div.row.hex-row', addr, bytes, chars];

}

export function Input () { /*TODO*/ }

export namespace Input {
  export const Title = () =>
    ['input#title[type=text][focused=focused]', { placeholder: 'name your project' }];
  export const Balance = () =>
    ['label.row.gap', ['strong.grow', 'Balance:'], ['input.balance', { disabled: true }]]
}

export function Select () { /* TODO */ }

export namespace Select {

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
    name = null as string,
    view = Html(['label.col.gap', { style: 'align-items:stretch' }, ['div.row.gap', ['em.grow', name], ['select.pick-user']], ['input.pubkey']]),
    input = view.querySelector('input'),
    select = view.querySelector('select'),
    update = (state: Select.Pubkey) => { state.input.value = state.select.value; return state },
  }: Partial<Select.Pubkey> = {}): Select.Pubkey {
    const state = { name, view, select, input, update };
    select.onchange = () => update(state);
    return update(state);
  }

  export function Sender ({
    name = 'Sender:',
    view = Html(['label.col.gap', { style: 'align-items:stretch' },
      ['div.row.gap', ['string.grow', name], ['select.pick-user']],
      Input.Balance()
    ]).firstChild,
    input = view.querySelector('input'),
    select = view.querySelector('select'),
    update = (state: Select.Sender) => { setTimeout(()=>updateSenderBalance(state), 1); return state },
  }: Partial<Select.Sender> = {}): Select.Sender {
    const state = { name, view, select, input, update };
    select.onchange = () => update(state);
    return update(state);
  }

  async function updateSenderBalance ({ select, input }) {
    const pubkey = select.value;
    const sender = (await import('./Simf.ts')).usersByPubkey[pubkey];
    input.value = String(await getBalances(sender.p2wpkh));
  }

  async function getBalances (
    p2wpkh: string,
    chain = Bitcoin.LiquidTestnet(),
    asset: string = "38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5"
  ): Promise<bigint> {
    let balance = 0n;
    const utxos  = await chain.esplora.getAddressUtxos(p2wpkh);
    for (const utxo of utxos) if (utxo.asset === asset) balance += BigInt(utxo.value);
    return balance
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

export function Icon (name: string) {
  return ['svg.icon', [`use[href=icons.svg#${name}]`]]
}

export namespace Icon {
  // preset icons
}
