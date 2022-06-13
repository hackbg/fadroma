import open from 'open'
export { open }

export { stderr, env } from 'process'

import onExit from 'signal-exit'
export { onExit }

export { execFile, execFileSync, spawn, spawnSync } from 'child_process'

import { bech32 } from 'bech32'
export { bech32 }
