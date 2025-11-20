import { DOM, Bytes } from '../../lib/index.ts';
import { Icon } from '../lib.ts';
import { Field } from './Field.ts';

export const Fields = {

  Text: (id: string, ...content: unknown[]) => Field({
    id,
    content: [[`textarea.collapsible#text:${id}`,
      content.filter(x=>typeof x === 'string').join('\n')]]
  }),

  TS: (id: string, ...content: unknown[]) => Field({
    id, collapsed: false,
    header:  [['div.command', Icon('play'), 'Check'], ['div.command', Icon('play'), 'Run']],
    content: [[`textarea.collapsible#text:${id}`,
      content.filter(x=>typeof x === 'string').join('\n')]]
  }),

  Simf: (id: string, ...content: unknown[]) => Field({
    id, collapsed: false,
    header:  [['div.command', Icon('play'), 'Compile']],
    content: [['div.collapsible',
      //SimfFn('main', ...content: unknown[]),
      //SimfFn('checksig'),
      //SimfFn('checksigfromstack'),
      ['div.row', ['div.grow'], ['div.command', Icon('circle-with-plus'), 'Define']]
    ]]
  }),
  
  SimfFn: (name, ...content: unknown[]) =>
    ['div.col.fn',
      ['div.row.align-center',
        ['strong.keyword', 'fn '],
        [`input[type=text][size=${name.length-2}]`, { value: name }],
        '(', [`input[type=text][size=2]`], ')',
        ' { ',
        ['div.grow'],
        ['div.command', Icon('circle-with-cross'), 'Remove']],
      ['textarea', content.join('\n')||' '],
      '}'],

  Witness: (id: string, ...content: unknown[]) => Field({
    id, collapsed: false,
    content: [['div.col.collapsible',
      Fields.WitnessRow('u32', 'ORACLE_HEIGHT', '1000'),
      Fields.WitnessRow('u32', 'ORACLE_PRICE',  '100000'),
      Fields.WitnessRow('sig', 'ORACLE_SIG',    ''),
      Fields.WitnessRow('sig', 'OWNER_SIG',     ''),
      ['div.row', ['div.grow'], ['div.command', Icon('circle-with-plus'), 'Witness']]]]
  }),

  WitnessRow: (t: 'sig'|'u32', k: string, v: string|Bytes) =>
    ['div.witness',
      ['div.row.gap',
        ['label', ['select', ['option', { value: t }, t]]],
        ['input[type=text].grow', { value: k }],
        ['label.row', ['input[type=text].grow', { value: v }]]]],

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

