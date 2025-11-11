#!/usr/bin/env -S deno run --allow-read --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1:18443
import { Test, Temp, joined, Log, } from '../index.ts';
import { Simplicity } from './simf.ts';
import { Btc } from './btc.ts';
const { the, is, has, includes, equals, } = Test;
const name = 'Hello';
const mock = () => { const mocked = []; return { path: '/mock/', mocked, mkdir: mock, writeFile: mock }; };
const config = { name, source: Example() };
const log = x => y => Log(x)(y);
export default Test.suite(import.meta, 'Simplicity',
  the('Project', () => {
    return Simplicity(config)
  },
    is('object'),
    has('write', 'function'),
    the('Write', async (p: Simplicity) => {
      console.log(0, p.write);
      console.log(1, await p.write());
      console.log(2, await p.write(mock()));
      return p.write(mock())
    },
      is('object'),
      has('path'),
      has('paths',
        has('/mock/README.md',    includes(name)),
        has(`/mock/${name}.simf`, includes(Example()))))),
  the('Compiler', () => Temp('simf', Simplicity)(config),
    the('Write', (p: Simplicity) => p.write()),
    is('object'),
    has('build'),
    the('Build', (p: Simplicity) => p.build())),
  the('Run'));

    //the('Run',   (p: Simplicity) => Btc(p.run)()))));
export function Example () {
  return joined('\n', [
    `fn main() {`,
    `  let ab: u16 = <(u8, u8)>::into((0x10, 0x01));`,
    `  let c: u16 = 0x1001;`,
    `  assert!(jet::eq_16(ab, c));`,
    `  let ab: u8 = <(u4, u4)>::into((0b1011, 0b1101));`,
    `  let c: u8 = 0b10111101;`,
    `  assert!(jet::eq_8(ab, c));`,
    `}`
  ])
}
