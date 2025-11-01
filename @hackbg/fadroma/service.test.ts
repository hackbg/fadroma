#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { testSuite }  from "./tester.ts";
export default testSuite(import.meta, 'Container',
  'Pull', 'Run', 'Kill', 'Build');
