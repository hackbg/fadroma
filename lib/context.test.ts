#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run --allow-import --allow-read --allow-write=/tmp/fadroma
import DOM from './context/dom.test.ts';
import Log from './context/log.test.ts';
import Net from './context/os.test.ts';
import OS  from './context/net.test.ts';
import { suite } from "./tester.ts";
export default suite(import.meta, 'Context', Log, OS, Net, DOM);
