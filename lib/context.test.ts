#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run --allow-import --allow-read --allow-write=/tmp/fadroma
//import { suite, is, has } from "../tester.ts";
import { Log } from "./context/Log.ts";
//globalThis.DocumentFragment ??= class {} as unknown as typeof DocumentFragment;
import Test, { is, has } from "./tester.ts";
export default Test(import.meta, 'Context',
  Test('Log', () => Log(),
    is('object'),
    has('log',   'function'),
    has('info',  'function'),
    has('warn',  'function'),
    has('error', 'function')),
  Test('OS'),
  Test('DOM', 'HTML', 'SVG'),
  Test('Networking',
    Test('Ports'),
    Test('TCP', Test('Connect'), Test('Listen')),
    Test('HTTP', Test('Fetch'), Test('Serve')),
    Test('WS')));
//#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
//import { the, suite, is, has } from "../tester.ts";
//import { Tui } from "./Tui.ts";
//globalThis.DocumentFragment ??= class {} as unknown as typeof DocumentFragment;
//export default suite(import.meta, 'TUI',
  //the('Input', () => {
    //console.log(1, Tui.In);
    //console.log(2, Tui.In());
    ////return Tui.In() 
  //}),
  ////the('Output',   () => { return Tui.Out() }),
  ////the('Combined', () => { return Tui()     }),
//);
//#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
//import { the, suite } from "../tester.ts";
//import Html from "./Html.ts";
//import Svg from "./Svg.ts";
//globalThis.DocumentFragment ??= class {} as unknown as typeof DocumentFragment;
//export default suite(import.meta, 'DOM',
  //the('Html', () => { return Html() },
    //the('Create'),
    //the('Select',
      //the('Mutate'))),
  //the('Svg', () => { return Svg() },
    //the('Create'),
    //the('Select',
      //the('Mutate'))));

//#!/usr/bin/env -S deno run -I --coverage --allow-env --allow-net --allow-run --allow-read=/tmp/fadroma --allow-write=/tmp/fadroma
//import { suite, the, has, is, equals }  from "../tester.ts";
//import { execImpl, spawnImpl } from '../deps.ts';
//import { Dir, Temp, Zip, Txt, Bin } from './fs.ts';
//import { Exec, Spawn, Env } from './svc.ts';
//import { Fn } from '../format.ts';

//export const testDir = the('Dir',
  //the('Current', () => Dir(),
    //is('function'),
    //has('path', equals(''))), 
  //the('Defined', () => Dir('test'),
    //is('function'),
    //has('path'),
    //Fn.Name('Create', (d: Fn) => d(mock()))),
  //the('Temp', () => { return Temp(); },
    //is('function'),
    //has('prefix'),
    ////the('Create', (t: Fn) => { return t(mock()); },
      //////is('object'),
      //////has('rimraf'),
    ////)
  //));

//export const testZip = the('Zip',
  //Zip('helloworld.zip',
    //Dir('hello', Txt('hello.txt')),
    //Dir('world', Bin('world.bin'))),
  //is('object', 'Uint8Array'),
  //has('name', 'string'),
  //has('tree', 'object'),
  //the('Write',
    //() => {
      //const txt = Txt('hello.txt');
      //const bin = Bin('world.bin');
      //const zip = Zip('helloworld.zip', Dir('hello', txt), Dir('world', bin));
      //return Dir(`/tmp/fadroma/${+new Date()}`, zip)
    //},
    //is('function'),
    //has('path', 'string'),
    //has('entries', 'object', 'Array'),
    //async d => await d(),
    //is('object'),
    //d => console.log(d)));

//export const testExec = the('Exec', () => Exec('true', 'foo', Env('ENV', "1")),
  //has('command', equals('true')),
  //has('options',
    //has('0', equals('foo')),
    //has('1', has('name', 'ENV'), has('value', '1'))),
  //(exec: Fn) => exec({ exec: execImpl }));

//export const testSpawn = the('Spawn', () => Spawn('true', 'foo', Env('ENV', "2")),
  //has('daemon', equals('true')),
  //has('options',
    //has('0', equals('foo')),
    //has('1', has('name', 'ENV'), has('value', '1'))),
  //(spawn: Fn) => spawn({ pids: {}, spawn: spawnImpl }),
  //has('argv'), has('env'), has('pid'))

//export default suite(import.meta, 'OS',

  //the('FS',
    //testDir,
    //testZip),

  //the('Service',
    //testExec,
    //testSpawn),

  //the('Container',
    //'Pull',
    //'Run',
    //'Kill',
    //'Build'),

  //the('Codegen',
    //'.gitignore',
    //'README',

    //the('ES',
      //'node/npm/pnpm',
      //'tsc',
      //'deno',
      //'eslint'),

    //the('Rust',
      //the('cargo', 'workspace'),
      //'bacon',
      //'mold')));

//function mock () {
  //const mocked = []
  //const mock = name => (...args) => mocked.push([name, ...args]);
  //return {
    //path: '/mock/',
    //mocked,
    //mkdir:     mock('mkdir'),
    //mkdtemp:   mock('mkdtemp'),
    //writeFile: mock('writeFile'),
    //rimraf:    mock('rimraf'),
  //}
//}

//function show () {
  //return function show (data, context) { context.log(data); return data }
//}
