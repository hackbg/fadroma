import { resolve, relative, dirname, basename, extname } from 'path'
import { existsSync, unlinkSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { cwd, stderr } from 'process'
import { fileURLToPath } from 'url'
import { randomBytes } from 'crypto'

import bignum from 'bignumber.js'

import { loadJSON, loadSchemas } from './schema.js'
import { mkdir, makeStateDir, touch, rimraf } from './sys.js'

const {bold} = colors

export {
  basename,
  bignum,
  cwd,
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

export const Console = filename => {
  filename = relative(process.cwd(), fileURLToPath(filename))
  const format = arg => '\n'+((typeof arg === 'object') ? render(arg) : arg)
  return {
    filename,
    format,
    table: rows      => console.log(table(rows)),
    info:  (...args) => console.info('ℹ️ ', ...args),
    log:   (...args) => console.log(...args),
    warn:  (...args) => console.warn('⚠️ ', ...args),
    error: (...args) => console.error('🦋', ...args),
    debug: (...args) => {
      if (!process.env.NODEBUG) {
        console.debug('\n' + colors.yellow(filename), ...args.map(format))
      }
      return args[0]
    }
  }
}
