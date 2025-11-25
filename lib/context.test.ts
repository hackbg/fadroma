#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run --allow-import --allow-read --allow-write=/tmp/fadroma
import UI  from './context/ui.test.ts';
import OS  from './context/os.test.ts';
import Net from './context/net.test.ts';
import { suite } from "./tester.ts";
export default suite(import.meta, 'Context', UI, OS, Net);
