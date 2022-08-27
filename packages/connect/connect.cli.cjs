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

const entrypoint = require('path').resolve(__dirname, 'connect.ts')
const invocation = [process.argv[0], ganesha, entrypoint, ...process.argv.slice(2)]
require('@hackbg/ganesha').main(invocation)
