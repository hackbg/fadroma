#!/usr/bin/env -S deno run --allow-read --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1:18443
import { Test, Temp, joined } from '@hackbg/fadroma';
import { Simplicity } from './simf.ts';
import { Btc } from './deps.ts';
const { the, is, has, includes, equals, } = Test;
const name = 'Hello';
const mock = () => { const mocked = []; return { path: '/mock/', mocked, mkdir: mock, writeFile: mock }; };
const config = { name, source: Example() };
export default Test.suite(import.meta, 'Simplicity',
  the('Project', () => Simplicity(config),
    is('object'),
    has('write', 'function'),
    the('Write', (p: Simplicity) => p.write(mock()),
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
//const cwd = resolvePath(fileURLToPath(import.meta.url), '..');
//export default Test.suite(import.meta, 'Simplicity',
  //async () => Simplicity(await Temp('test-simf')(), { name, source: Examples[1]() }),
  //the('Init', project => project.write(), has('cwd'), has('paths'), ({ cwd, paths }) => {
    //Test.ok(paths[`${cwd}/README.md`].includes(name));
    //Test.ok(paths[`${cwd}/${name}.simf`].includes(Examples[1]()));
    //Test.equal(paths[`${cwd}/${name}.wit`], undefined);
  //}),
  //the('Build', project => project.build(), is('object', 'Uint8Array')),
  //the('Run', async () => {
    //const btcd = await Btc().spawnNode()();
    //await portWait({ port: '18443' })();
    //await Btc().execCli('createwallet', 'foobarz')();
    //const run = project.run(program);
    //const result = await run();
    //log({ program, btcd, result });
  //}));
