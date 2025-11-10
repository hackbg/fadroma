#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run --allow-read=/tmp/fadroma --allow-write=/tmp/fadroma
import { Dir, Temp, Txt } from './fs.ts';
import { suite, the, is, has }  from "./tester.ts";

export default suite(import.meta, 'FS',
  the('Dir',
    the('Current', () => { return Dir()       }, has('path'), is('object')), 
    the('Specify', () => { return Dir('test') }, has('path'), is('function'),
      async d => { console.log({d0:await d}); console.log({d0:await d}); return d },
      the('Create', d => { console.log({d}); return d(mock()) })),

    the('Temp',    () => { return Temp()    }, has('prefix'), is('function'),
      the('Create', t => { return t(mock()) }, is('object'),  has('rimraf')))));

function mock () {
  const mocked = []
  const mock = name => (...args) => mocked.push([name, ...args]);
  return {
    path: '/mock/',
    mocked,
    mkdir: mock('mkdir'),
    mkdtemp: mock('mkdtemp'),
    writeFile: mock,
  }
}

function show () {
  return function show (data, context) { context.log(data); return data }
}
