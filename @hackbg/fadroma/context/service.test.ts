#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { suite, the }  from "./tester.ts";
export default suite(import.meta, 'Service',
  the('Container', 'Pull', 'Run', 'Kill', 'Build'));
