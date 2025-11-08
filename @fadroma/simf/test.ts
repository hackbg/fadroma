#!/usr/bin/env -S deno run --allow-read --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1:18443
import { Fn, Test, Temp, portWait } from '@hackbg/fadroma';
import { Simplicity } from './simf.ts';
import { Btc, pipe } from './deps.ts';
import { execImpl, spawnImpl } from '../../@hackbg/fadroma/deps.ts';
const { the } = Test;

//const cwd = resolvePath(fileURLToPath(import.meta.url), '..');
const name = 'Hello';

export default Test.suite(import.meta, 'Simplicity', async (_, { log }) => {
  const source  = Examples[1]();
  const project = Simplicity({ name, source });
  console.log(project);
  //const project  = await Temp('test-simf', template)() as Simplicity;
  const {paths} = await project.write();
  console.log({paths});
  Test.ok(paths[`README.md`].includes(name));
  Test.ok(paths[`${name}.simf`].includes(source));
  Test.equal(paths[`${name}.wit`], undefined);
  const program = await project.build();
  const btcd = await Btc().spawnNode()();
  await portWait({ port: '18443' })();
  await Btc().execCli('createwallet', 'foobarz')();
  const run = project.run(program);
  const result = await run();
  log({ program, btcd, result });
});

export const Examples = {

  1: () => [
    `fn main() {`,
    `  let ab: u16 = <(u8, u8)>::into((0x10, 0x01));`,
    `  let c: u16 = 0x1001;`,
    `  assert!(jet::eq_16(ab, c));`,
    `  let ab: u8 = <(u4, u4)>::into((0b1011, 0b1101));`,
    `  let c: u8 = 0b10111101;`,
    `  assert!(jet::eq_8(ab, c));`,
    `}`
  ].join('\n')

}

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
