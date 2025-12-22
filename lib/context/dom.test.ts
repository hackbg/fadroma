#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { the, suite } from "../tester.ts";
import { Html } from "./html.ts";
import { Svg } from "./svg.ts";
globalThis.DocumentFragment ??= class {} as unknown as typeof DocumentFragment;
export default suite(import.meta, 'DOM',
  the('Html', () => { return Html() },
    the('Create'),
    the('Select',
      the('Mutate'))),
  the('Svg', () => { return Svg() },
    the('Create'),
    the('Select',
      the('Mutate'))));
