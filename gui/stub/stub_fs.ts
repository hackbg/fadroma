export async function mkdir () {}

export async function rm () {}

export async function mkdtemp () {}

export async function writeFile () {}

export async function readFile (path) {
  throw new Error(`Resource unavailable: ${path}.`)
}

export function realpathSync () {}
