#!/usr/bin/env node

if (!!process.env.Ganesha) {

  if (!process.argv[2]) {
    console.info('Pass a deploy script.')
    process.exit(1)
  }

  console.info('Using deploy script:', process.argv[2])

  import(require('path').resolve(process.cwd(), process.argv[2])).then(deployScript=>{
    if (!deployScript.default) {
      console.error(`${process.argv[2]} has no default export.`)
      console.info(
        `Export an instance of DeployCommands `+
        `to make this file a deploy script:`
      )
      console.info(
        `\n\n`                                                     +
        `    import { DeployCommands } from '@fadroma/deploy'\n\n` +
        `    const deploy = new DeployCommands('deploy')\n`        +
        `    export default deploy\n\n`                            +
        `    deploy.command('my-deploy-command', 'command info', async function (context) {\n\n` +
        `      /* your deploy procedure here */\n\n` +
        `    })\n`
      )
      process.exit(2)
    }
    return deployScript.default.launch(process.argv.slice(3))
  }).catch(e=>{
    console.error(e)
    process.exit(3)
  })

} else {

  let dotenv
  try { dotenv = require('dotenv') } catch (e) {}
  if (dotenv) dotenv.config()

  let ganesha
  try { ganesha = require.resolve('@hackbg/ganesha') } catch (e) {
    console.error(e)
    console.error('Could not find @hackbg/ganesha. CLI not available ;d')
    process.exit(4)
  }

  const interpreter   = process.argv[0]
  const transpiler    = ganesha
  const entrypoint    = __filename
  const args          = process.argv.slice(2)
  process.env.Ganesha = true
  require('@hackbg/ganesha').main([interpreter, transpiler, entrypoint, args])

}
