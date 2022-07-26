let ganesha
try {
  ganesha = require.resolve('@hackbg/ganesha')
} catch (e) {
  console.error(e)
  console.error('Could not find @hackbg/ganesha. CLI not available ;d')
  process.exit(1)
}

let build
try {
  ganesha = require.resolve('@fadroma/build/build.ts')
} catch (e) {
  console.error(e)
  console.error('Could not find @fadroma/build. CLI not available ;d')
  process.exit(1)
}

require('@hackbg/ganesha').main([process.argv[0], build, process.argv.slice(2)]) 
