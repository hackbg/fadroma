import { fileURLToPath } from 'url'
import { readFileSync, existsSync, statSync, writeFileSync, unlinkSync } from 'fs'
import { stat, readFile, writeFile, unlink } from 'fs/promises'
import { resolve, relative, dirname, basename, extname } from 'path'
import { execFileSync, spawnSync } from 'child_process'
import { homedir } from 'os'
import { cwd, stderr } from 'process'
import mkdirp from 'mkdirp'
import rimraf from 'rimraf'
import onExit from 'signal-exit'
import xdgAppPaths from 'xdg-app-paths'

export const defaultDataDir = () => xdgAppPaths.data()
export const mkdir = (...fragments) => {
  const path = resolve(...fragments)
  if (!existsSync(path)) console.debug('creating', path)
  mkdirp.sync(path, {mode: 0o770})
  return path }
export const touch = (...fragments) => {
  const path = resolve(...fragments)
  if (!existsSync(path)) console.debug('creating', path)
  writeFileSync(path, '')
  return path }
export const makeStateDir = (path, ...subdirs) => {
  // somewhere to store localnet state,
  // as well as upload receipts for all networks:
  if (path.startsWith('file://')) path = fileURLToPath(path)
  if (existsSync(path) && (statSync(path)).isFile()) path = dirname(path)
  return mkdir(path, ...subdirs) }

export { stderr
       , resolve, relative, dirname, basename, extname
       , fileURLToPath, cwd, homedir
       , existsSync, readFile, writeFile, unlink, rimraf }
