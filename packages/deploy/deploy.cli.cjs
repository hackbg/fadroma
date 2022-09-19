#!/usr/bin/env node

async function main () {
  if (!process.env.Fadroma) {
    // Modification to process.env persists in child process
    process.env.Fadroma = true
    // Run the entry point of Komandi, which relaunches the process
    // with Ganesha enabled for TypeScript support
    require('@hackbg/komandi/komandi.cli.cjs')
  } else {
    // Call the default export of the deploy script
    const script = process.argv[2]
    if (!script) exit.noScript()
    console.log()
    const scriptPath = require('path').resolve(process.cwd(), script)
    import(scriptPath).then(
      async ({ default: entrypoint })=>{
        if (!entrypoint) exit.noEntrypoint(script)
        await Promise.resolve(entrypoint(process.argv.slice(3))).catch(exit.scriptError)
      },
      e => exit.importError(scriptPath, e)
    )
  }
}

const exit = {
  ok () {
    process.exit(0)
  },
  scriptError (e) {
    console.error(e)
    process.exit(1)
  },
  noScript () {
    console.error('Pass a deploy script.')
    process.exit(2)
  },
  importError (scriptPath, e) {
    console.error('Failed to load', scriptPath)
    console.error(e)
    process.exit(3)
  },
  noEntrypoint (script) {
    console.error(
      `${script} has no default export.\n` +
      `Export a default function to serve as entrypoint to your deploy script, e.g.:\n\n`+
      `  import DeployCommands from '@fadroma/deploy'\n`+
      `  export default async () => (await MyDeployment.init()).entrypoint(import.meta.url)\n`+
      `  class MyDeployment extends DeployCommands {\n` +
      `    /* ... implementation ... */\n` +
      `  }`
    )
    process.exit(4)
  },
}

main()
