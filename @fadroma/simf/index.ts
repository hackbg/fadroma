import { dir, text, data, exec } from './deps.ts';

export function simfInit ({
  name = null,
  witness = null,
} = {}) {
  return dir(name,
    text(`${name}.simc`, '',
      x => x + 'fn main() {',
      x => x + '  let ab: u16 = <(u8, u8)>::into((0x10, 0x01));',
      x => x + '  let c: u16 = 0x1001;',
      x => x + '  assert!(jet::eq_16(ab, c));',
      x => x + '  let ab: u8 = <(u4, u4)>::into((0b1011, 0b1101));',
      x => x + '  let c: u8 = 0b10111101;',
      x => x + '  assert!(jet::eq_8(ab, c));',
      x => x + '}'),
    witness && data(`${name}.wit`))
}

export function simfBuild ({
  simc = 'simc',
  simf = null,
  witness = null,
}) {
}
