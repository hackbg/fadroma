import { resolve, relative, dirname, basename, extname } from 'path'
import { existsSync, unlinkSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { cwd, stderr } from 'process'
import { fileURLToPath } from 'url'
import { randomBytes } from 'crypto'
import bignum from 'bignumber.js'
import { loadJSON, loadSchemas } from './schema.js'
import { mkdir, makeStateDir, touch, rimraf } from './sys.js'
import colors from 'colors'

const {bold} = colors

const randomHex = (bytes) => randomBytes(bytes).toString("hex")

const decoder = new TextDecoder();
const decode = (buffer) => decoder.decode(buffer).trim()

export {
  basename,
  bignum,
  bold,
  cwd,
  decode,
  dirname,
  existsSync,
  statSync,
  extname,
  fileURLToPath,
  loadJSON,
  loadSchemas,
  makeStateDir,
  mkdir,
  randomBytes,
  randomHex,
  readdirSync,
  readFile,
  readFileSync,
  resolve,
  rimraf,
  relative,
  stderr,
  touch,
  unlinkSync,
  writeFile,
  writeFileSync,
}
