import { pipe, dir, text, data, exec, resolvePath, fileURLToPath } from './deps.ts';

export function simfInit ({
  name    = null,
  simf    = name && `${name}.simc`,
  witness = name && `${name}.wit`,
} = {}) {
  return dir(name,
    text(simf, 'fn main() {\n',
      x => x + '  let ab: u16 = <(u8, u8)>::into((0x10, 0x01));\n',
      x => x + '  let c: u16 = 0x1001;\n',
      x => x + '  assert!(jet::eq_16(ab, c));\n',
      x => x + '  let ab: u8 = <(u4, u4)>::into((0b1011, 0b1101));\n',
      x => x + '  let c: u8 = 0b10111101;\n',
      x => x + '  assert!(jet::eq_8(ab, c));\n',
      x => x + '}\n'),
    witness && data(`${name}.wit`));
}

export function simfBuild ({
  simc    = defaultSimc,
  name    = null,
  simf    = name && `${name}.simf`,
  witness = name && `${name}.wit`,
}) {
  return ctx => pipe(
    exec(simc, resolvePath(ctx.cwd, simf)),
    ctx => ctx.stdout.split('\n')[1],
  )(ctx)
}

const defaultSimc = resolvePath(fileURLToPath(import.meta.url), '../simc');
