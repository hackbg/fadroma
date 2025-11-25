#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { the, suite, is, has } from "./tester.ts";
import { Log, Html, Svg, Tui } from "./ui.ts";
globalThis.DocumentFragment ??= class {} as unknown as typeof DocumentFragment;
export default suite(import.meta, 'UI',

  the('Html', () => { return Html() },
    the('Create'),
    the('Select',
      the('Mutate'))),

  the('Svg', () => { return Svg() },
    the('Create'),
    the('Select',
      the('Mutate'))),

  the('TUI',
    the('Input',    () => { return Tui.In()  }),
    the('Output',   () => { return Tui.Out() }),
    the('Combined', () => { return Tui()     })),

  the('Log', () => { return Log() },
    is('object'),
    has('log',   'function'),
    has('info',  'function'),
    has('warn',  'function'),
    has('error', 'function')));
