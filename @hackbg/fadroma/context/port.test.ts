#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { suite }  from "./tester.ts";
export default suite(import.meta, 'Port')
