#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import Test from "../library/Test.ts";
export default Test(import.meta, 'Watch', 'Check', 'Test');
