#!/usr/bin/env -S deno run --allow-read --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1:18443
import { Test, Temp, portWait } from '@hackbg/fadroma';
import { Simplicity } from './index.ts';
import { Btc, pipe } from './deps.ts';
import { execImpl, spawnImpl } from '../../@hackbg/fadroma/deps.ts';
const { the } = Test;

//const cwd = resolvePath(fileURLToPath(import.meta.url), '..');
const name = 'Hello';

export default Test.suite(import.meta, 'Simplicity',
  async function testSimplicity (_, { log }) {
    const source = Examples[1]();
    const context = { exec: execImpl, spawn: spawnImpl, ports: {} };
    const project = Simplicity(await Temp('test-simf')(), { name, source });
    const {cwd, paths} = await project.init();
    Test.ok(paths[`${cwd}/README.md`].includes(name));
    Test.ok(paths[`${cwd}/${name}.simf`].includes(source));
    Test.equal(paths[`${cwd}/${name}.wit`], undefined);
    const program = await project.build();
    const btcd = await Btc().spawnNode(context);
    await portWait({ port: '18443' })();
    const run = project.run();
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
