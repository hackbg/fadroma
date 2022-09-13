#!/usr/bin/env node

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
  importError (e) {
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

if (!process.env.FadromaDeploy) {
  // Relaunch with Ganesha
  process.env.FadromaDeploy = true
  require('@hackbg/komandi/komandi.cli.cjs')
} else {
  // Call the default export of the deploy script
  const script = process.argv[2]
  if (!script) exit.noScript()
  console.info('\nDeploy script:', script)
  const scriptPath = require('path').resolve(process.cwd(), script)
  import(scriptPath).then(
    async ({ default: entrypoint })=>{
      if (!entrypoint) exit.noEntrypoint(script)
      await Promise.resolve(entrypoint(process.argv.slice(3))).catch(exit.scriptError)
    },
    exit.importError
  )
}
