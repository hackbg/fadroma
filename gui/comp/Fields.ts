import { DOM, Bytes } from '../../lib/index.ts';
import { Field } from './Field.ts';
import { Command } from './Command.ts';

export const Fields = {

  textarea: (id: string, ...content: string[]) =>
    [`textarea.collapsible#text:${id}`,
      {autocomplete: "off", autocorrect: "off", autocapitalize: "off", spellcheck: false},
      content.filter(x=>typeof x === 'string').join('\n')],

  Text: (id: string, ...content: string[]) => Field({
    id, content: [Fields.textarea(id, ...content)],
  }),

  TS: (id: string, ...content: string[]) => Field({
    id, content: [Fields.textarea(id, ...content)],
    collapsed: false, header: [Command('play', 'Check'), Command('play', 'Run')],
  }),

  Simf: (id: string, ...content: unknown[]) => Field({
    id, collapsed: false, header: [Command('play', 'Compile')],
    content: [['div.collapsible',
      //SimfFn('main', ...content: unknown[]),
      //SimfFn('checksig'),
      //SimfFn('checksigfromstack'),
      ...content,
      ['div.row', ['div.grow'], Command('circle-with-plus', 'Define')]
    ]]
  }),
  
  SimfFn: (name: string, ...content: unknown[]) =>
    ['div.col.fn',
      ['div.row.align-center',
        ['strong.keyword', 'fn '],
        [`input[type=text][size=${name.length-2}]`, { value: name }],
        '(', [`input[type=text][size=2]`], ')',
        ' { ',
        ['div.grow'],
        Command('circle-with-cross', 'Remove')],
      ['textarea', content.join('\n')||' '],
      '}'],

  Witness: (id: string, ...content: unknown[]) => Field({
    id, collapsed: false,
    content: [['div.col.collapsible',
      Fields.WitnessRow('u32', 'ORACLE_HEIGHT', '1000'),
      Fields.WitnessRow('u32', 'ORACLE_PRICE',  '100000'),
      Fields.WitnessRow('sig', 'ORACLE_SIG',    ''),
      Fields.WitnessRow('sig', 'OWNER_SIG',     ''),
      ['div.row', ['div.grow'], Command('circle-with-plus', 'Witness')]]]
  }),

  WitnessRow: (t: 'sig'|'u32', k: string, v: string|Bytes) =>
    ['div.witness',
      ['input[type=text].grow', { value: k, placeholder: 'name' }],
      ['label', ['select', ['option', { value: t }, t]]],
      ['label.row', ['input[type=text].grow', { value: v, placeholder: 'value' }]],
      Command('circle-with-cross', 'Remove')],

  Hex: (id: string, ...content: unknown[]) =>
    DOM([`div.field.file.hex#${id}`,
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
        Fields.HexRow('00000030 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................')]]),

  HexRow: (addr, bytes, chars) =>
    ['div.row.hex-row', addr, bytes, chars],

};

