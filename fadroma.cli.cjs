#!/usr/bin/env cmds

//const exit = {

  //ok () {
    //process.exit(0)
  //},

  //async scriptError (e) {
    //const {Console} = await import('@hackbg/logs')
    //const log = new Console('@fadroma/deploy: cli')
    //log.error(e.message)
    //for (const key in e) {
      //if (key === 'message' || key === 'stack' || key === 'txBytes') continue
      //log.error(`  ${(key+':').padEnd(18)} ${e[key]}`)
    //}
    //log.error(`\n${e.stack}`)
    //process.exit(1)
  //},

  //noScript () {
    //console.error('Pass a deploy script.')
    //process.exit(2)
  //},

  //importError (scriptPath, e) {
    //console.error('Failed to load', scriptPath)
    //console.error(e)
    //process.exit(3)
  //},

  //noEntrypoint (script) {
    //console.error(
      //`${script} has no default export.\n` +
      //`Export a default function to serve as entrypoint to your deploy script, e.g.:\n\n`+
      //`  import { Deployer } from '@fadroma/deploy'\n`+
      //`  class MyDeployment extends Deployer {\n` +
      //`    /* ... implementation ... */\n` +
      //`  }` +
      //`  export default MyDeployment.run()`
    //)
    //process.exit(4)
  //},

//}

//// The process.env.Fadroma environment variable is set
//// after Ganesha has enabled on-demand loading of TypeScript
//if (process.env.Fadroma) {

  //const command = process.argv[2]
  //if (!command) exit.noScript()

  //console.log()
  //switch (command) {

    //case 'build':
      //require('./packages/build/build.cli.cjs')
      //break

    //case 'deploy':
      //require('./packages/deploy/deploy.cli.cjs')
      //break

    //case 'devnet':
      //require('./packages/devnet/devnet.cli.cjs')
      //break

    //default:
      //// Call the default export of the deploy script
      //const scriptPath = require('path').resolve(process.cwd(), command)
      //import(scriptPath).then(
        //async ({ default: entrypoint })=>{
          //if (!entrypoint) exit.noEntrypoint(script)
          //await Promise.resolve(entrypoint(process.argv.slice(3))).catch(exit.scriptError)
        //},
        //e => exit.importError(scriptPath, e)
      //)

  //}

//} else {
  //// Trampoline to the entry point of Komandi, which then trampolines
  //// back to this script with TypeScript support enabled by Ganesha
  //process.env.Fadroma = true
  //require('@hackbg/cmds/cmds.cli.cjs')
//}
