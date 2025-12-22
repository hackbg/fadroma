#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { the, suite, is, has } from "../tester.ts";
import { Tui } from "./tui.ts";
globalThis.DocumentFragment ??= class {} as unknown as typeof DocumentFragment;
export default suite(import.meta, 'TUI',
  the('Input', () => {
    console.log(1, Tui.In);
    console.log(2, Tui.In());
    //return Tui.In() 
  }),
  //the('Output',   () => { return Tui.Out() }),
  //the('Combined', () => { return Tui()     }),
);
