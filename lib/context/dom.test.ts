#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { suite } from "./tester.ts";
import { DOM } from './dom.ts';
// TODO test with jsdom
export default suite(import.meta, 'DOM', 'Create', 'Select', 'Mutate');
