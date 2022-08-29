#!/usr/bin/env node

let dotenv
try { dotenv = require('dotenv') } catch (e) {}
if (dotenv) dotenv.config()

let ganesha
try { ganesha = require.resolve('@hackbg/ganesha') } catch (e) {
  console.error(e)
  console.error('Could not find @hackbg/ganesha. CLI not available ;d')
  process.exit(1)
}

const entrypoint = require('path').resolve(__dirname, 'deploy.ts')
const invocation = [process.argv[0], ganesha, entrypoint, ...process.argv.slice(2)]
require('@hackbg/ganesha').main(invocation)

//if (
  ////@ts-ignore
  //fileURLToPath(import.meta.url) === process.argv[1]
//) {
  //if (process.argv.length > 2) {
    //console.info('Using deploy script:', bold(process.argv[2]))
    ////@ts-ignore
    //import(resolve(process.argv[2])).then(deployScript=>{
      //const deployCommands = deployScript.default
      //if (!deployCommands) {
        //console.error(`${process.argv[2]} has no default export.`)
        //console.info(
          //`Export an instance of DeployCommands `+
          //`to make this file a deploy script:`
        //)
        //console.info(
          //`\n\n`                                                     +
          //`    import { DeployCommands } from '@fadroma/deploy'\n\n` +
          //`    const deploy = new DeployCommands('deploy')\n`        +
          //`    export default deploy\n\n`                            +
          //`    deploy.command('my-deploy-command', 'command info', async function (context) {\n\n` +
          //`      /* your deploy procedure here */\n\n` +
          //`    })\n`
        //)
        //process.exit(2)
      //}
      //return deployCommands.launch(process.argv.slice(3))
    //}).catch(e=>{
      //console.error(e)
      //process.exit(1)
    //})
  //} else {

    //new Komandi.Command('deploy status' 'show deployment status', [
      //Connect.connect,
      //Connect.log.chainStatus,
      //getDeployContext,
      //log.deployment
    //]).run(process.argv.slice(2))

  //}
//}
