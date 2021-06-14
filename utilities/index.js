import { resolve, relative, dirname, basename, extname } from 'path'
import { existsSync, unlinkSync, readFileSync, writeFileSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { cwd, stderr } from 'process'
import { fileURLToPath } from 'url'
import { randomBytes } from 'crypto'

import bignum from 'bignumber.js'
import {render} from 'prettyjson'
import colors from 'colors/safe.js'

import { loadJSON, loadSchemas } from './schema.js'
import { table, getBorderCharacters } from 'table'
import markdownTable from './table.js'
import taskmaster from './taskmaster.js'
import { mkdir, makeStateDir, touch, rimraf } from './sys.js'

const {bold} = colors

export {
  basename,
  bignum,
  bold,
  cwd,
  dirname,
  existsSync,
  extname,
  fileURLToPath,
  getBorderCharacters,
  loadJSON,
  loadSchemas,
  makeStateDir,
  markdownTable,
  mkdir,
  randomBytes,
  readFile,
  readFileSync,
  render,
  resolve,
  rimraf,
  relative,
  stderr,
  table,
  taskmaster,
  touch,
  unlinkSync,
  writeFile,
  writeFileSync
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

export const noBorders = {
  border: getBorderCharacters('void'),
  columnDefault: { paddingLeft: 0, paddingRight: 2 },
  drawHorizontalLine: () => false
}
