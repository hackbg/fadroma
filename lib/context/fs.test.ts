#!/usr/bin/env -S deno run -I --coverage --allow-env --allow-net --allow-run --allow-read=/tmp/fadroma --allow-write=/tmp/fadroma
import { Dir, Temp, Zip, Txt, Bin } from './fs.ts';
import { suite, the, is, has, equals }  from "./tester.ts";
import { Name } from '../format.ts';
import type { Fn } from '../index.ts';

export default suite(import.meta, 'FS',
  the('Dir',
    the('Current', () => Dir(),
      is('function'),
      has('path', equals(''))), 
    the('Defined', () => Dir('test'),
      is('function'),
      has('path'),
      async (d, { log }) => { log({d0:await d}); return d; },
      Name('Create', async (d: Fn, { log }) => {
        log({d1:d});
        const result = await d(mock());
        log({d2: result});
        return result })),
    the('Temp', () => { return Temp(); },
      is('function'),
      has('prefix'),
      the('Create', (t: Fn) => { return t(mock()); },
        is('object'),
        has('rimraf')))),

  the('Zip',
    Zip('helloworld.zip',
      Dir('hello', Txt('hello.txt')),
      Dir('world', Bin('world.bin'))),
    is('object', 'Uint8Array'),
    has('name', 'string'),
    has('tree', 'object'),
    the('Write',
      () => Dir(`/tmp/fadroma/${+new Date()}`,
        Zip('helloworld.zip',
          Dir('hello', Txt('hello.txt')),
          Dir('world', Bin('world.bin')))),
      is('function'),
      has('path', 'string'),
      has('entries', 'object', 'Array'),
      async d => await d(),
      is('object'),
      d => console.log(d))));

function mock () {
  const mocked = []
  const mock = name => (...args) => mocked.push([name, ...args]);
  return {
    path: '/mock/',
    mocked,
    mkdir:     mock('mkdir'),
    mkdtemp:   mock('mkdtemp'),
    writeFile: mock('writeFile'),
    rimraf:    mock('rimraf'),
  }
}

function show () {
  return function show (data, context) { context.log(data); return data }
}
