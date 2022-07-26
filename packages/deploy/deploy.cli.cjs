let ganesha
try {
  ganesha = require.resolve('@hackbg/ganesha')
} catch (e) {
  console.error(e)
  console.error('Could not find @hackbg/ganesha. CLI not available ;d')
  process.exit(1)
}

let deploy
try {
  deploy = require.resolve('@fadroma/deploy/deploy.ts')
} catch (e) {
  console.error(e)
  console.error('Could not find @fadroma/deploy. CLI not available ;d')
  process.exit(1)
}

require('@hackbg/ganesha').main([process.argv[0], ganesha, deploy, ...process.argv.slice(2)])
