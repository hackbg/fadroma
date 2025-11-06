#!/usr/bin/env -S deno run --allow-read --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1:18443
import { Test, pipe, Temp, FS, chunked, portWait } from '@hackbg/fadroma';
import { simfInit, simfBuild, simfRun } from './index.ts';
import { resolvePath, fileURLToPath, Btc } from './deps.ts';
import { execImpl, spawnImpl } from '../../@hackbg/fadroma/deps.ts';
const { the } = Test;
const cwd = resolvePath(fileURLToPath(import.meta.url), '..');
const name = 'Simplicity Test Project';
export default Test.suite(import.meta, 'Simplicity', testSimplicity);
async function testSimplicity () {
  const project = Temp('test-simf', simfInit({ name, simf: Simf0() }));
  const [written] = await project(FS());
  Test.ok(written[0].includes(name));
  Test.ok(written[1].includes('u4, u4'));
  Test.equal(written[2], undefined);
  const context = { cwd, exec: execImpl, spawn: spawnImpl, ports: {} };
  const program = await simfBuild({ name: 'example' })(context);
  console.log({context});
  const btcd = await Btc().spawnNode(context);
  console.log({btcd});
  await portWait({ port: '18443' })();
  console.log('ready');
  const result  = await simfRun({ program })(context);
  console.log({ program, btcd, result });
}
function Simf0 () {
  return [
    `fn main() {`,
    `  let ab: u16 = <(u8, u8)>::into((0x10, 0x01));`,
    `  let c: u16 = 0x1001;`,
    `  assert!(jet::eq_16(ab, c));`,
    `  let ab: u8 = <(u4, u4)>::into((0b1011, 0b1101));`,
    `  let c: u8 = 0b10111101;`,
    `  assert!(jet::eq_8(ab, c));`,
    `}`
  ];
}
