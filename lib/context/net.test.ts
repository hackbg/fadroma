#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { the, suite } from "../tester.ts";
export default suite(import.meta, 'Networking',
  the('Ports'),
  the('TCP',
    the('Connect'),
    the('Listen')),
  the('HTTP',
    the('Fetch'),
    the('Serve')),
  the('WS'));
