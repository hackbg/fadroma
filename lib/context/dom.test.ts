#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { the, suite, equals, is, has } from "./tester.ts";
import { DOM } from './dom.ts';
// TODO test with jsdom
export default suite(import.meta,
  the('DOM'),
    //the('Empty', () => DOM(),
      //equals(DocumentFragment),
      //has('firstChild', is(null))),
    //the('Passthru', () => DOM(DOM()),
      //equals(DocumentFragment),
      //has('firstChild', is(DocumentFragment))),
    //the('Element'),
    //the('Elements')),
  'Create',
  'Select',
  'Mutate');
