import Html from '../../library/Html.ts';
import { Bytes } from '../../library/Byte.ts';
import { elById, Icon } from '../lib.ts';
import Command from './Command.ts';

export default Field;

function Field ({ id, collapsed = true, header = [], content = [] }) {
  return Field.Wrapper(id, collapsed, Field.Handle(id, collapsed),
    ['div.flex.col.grow', Field.Header(id, ...header), ...content]);
}

namespace Field {

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
}

export namespace Fields {

  export function TextArea (id: string, ...content: string[]) {
    return [`textarea.collapsible#text:${id}`,
      {autocomplete: "off", autocorrect: "off", autocapitalize: "off", spellcheck: false},
      content.filter(x=>typeof x === 'string').join('\n')];
  }

  export const Text = (id: string, ...content: string[]) => Field({
    id, content: [Fields.TextArea(id, ...content)], });

  export const TS = (id: string, ...content: string[]) => Field({
    id, header: [
      Command('play', 'Check'), Command('play', 'Run')
    ], content: [
      Fields.TextArea(id, ...content) ], });

  export const Simf = (id: string, ...content: string[]) => Field({
    id, header: [
      Command('play', 'Compile', { onclick: simfCompile(id) }),
      //Command('circle-with-plus', 'Define')
    ], content: [
      Fields.TextArea(id, ...content),
      [`div.row#result:${id}`, ['div.grow']],
      [`div.row.simf-result`, ['strong', `P2TR: `],
        [`div.grow#commit:${id}`, `(not compiled)`],
        ['a.help', { target: 'blank', title: 'Address of program', href: "#" }, Icon('help')]],
      [`div.row.simf-result`, ['strong.w', `Sighash: `],
        [`div.grow#cmr:${id}`, `(not generated)`],
        ['a.help', { target: 'blank', title: 'Witness signing hash', href: "#" }, Icon('help')]],
    ] });

  let simf = null
  function simfCompile (id) {
    return async e => {
      simf ??= await import('../../platform/SimplicityHL/pkg/fadroma_simf.js')
      console.log(e.target)
      const resp = await fetch('/wasm/simf.wasm');
      const wasm = await resp.bytes();
      console.log({simf, resp, wasm});
      console.log(await simf.default(wasm));
      const result = simf.build('fn main () {}', {});
      console.log({result});
      elById(`result:${id}`).style.whiteSpace = 'pre';
      elById(`commit:${id}`).innerText = result.commit;
      elById(`cmr:${id}`).innerText = result.cmr;
      elById(`amr:${id}`).innerText = result.amr;
      elById(`ihr:${id}`).innerText = result.ihr;
    }
  }

  export const SimfFn = (name: string, ...content: unknown[]) =>
    ['div.col.fn',
      ['div.row.align-center',
        ['strong.keyword', 'fn '],
        [`input[type=text][size=${name.length-2}]`, { value: name }],
        '(', [`input[type=text][size=2]`], ')',
        ' { ',
        ['div.grow'],
        Command('circle-with-cross', 'Remove')],
      ['textarea', content.join('\n')||' '], '}'];

  export const Witness = (id: string, ...content: unknown[]) => Field({
    id, collapsed: true, header: [
      ['select', ['option', 'src/main.simf']],
      Command('play', 'Satisfy', { onclick: simfCompile(id) }),
    ], content: [['div.col.collapsible',
      Fields.WitnessRow('u32', 'ORACLE_HEIGHT', '1000'),
      Fields.WitnessRow('u32', 'ORACLE_PRICE',  '100000'),
      Fields.WitnessRow('sig', 'ORACLE_SIG',    ''),
      Fields.WitnessRow('sig', 'OWNER_SIG',     ''),
      ['div.row', ['div.grow'], Command('circle-with-plus', 'Witness')]]] });

  export const WitnessRow = (t: 'sig'|'u32', k: string, v: string|Bytes) =>
    ['div.witness',
      ['input[type=text].grow', { value: k, placeholder: 'name' }],
      ['label', ['select', ['option', { value: t }, t]]],
      ['label.row', ['input[type=text].grow', { value: v, placeholder: 'value' }]],
      Command('circle-with-cross', 'Remove')];

  export const Hex = (id: string, ...content: unknown[]) =>
    Html([`div.field.file.hex#${id}`,
      ['div.handle-v', { onclick: Field.toggle(id) },
        ['svg.icon.expanded', ['use[href=icons.svg#chevron-down]']],
        ['div.grow']],
      ['div.flex.col.grow',
        ['div.flex.row',
          ['div.name',     { onclick: Field.toggle(id) }, id],
          ['div.handle-h', { onclick: Field.toggle(id) }]],
        Fields.HexRow('00000000 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
        Fields.HexRow('00000010 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
        Fields.HexRow('00000020 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
        Fields.HexRow('00000030 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................')]]);

  export const HexRow = (addr, bytes, chars) =>
    ['div.row.hex-row', addr, bytes, chars];
}
