import * as colors from 'colors/safe.js'
import { table, getBorderCharacters } from 'table'
import { render } from 'prettyjson'
import { printUsage, runCommand } from './cli-kit.js'
import taskmaster from './taskmaster.js'

export {
  table, getBorderCharacters, colors, render,
  printUsage, runCommand, taskmaster,
}

export const noBorders = {
  border: getBorderCharacters('void'),
  columnDefault: { paddingLeft: 0, paddingRight: 2 },
  drawHorizontalLine: () => false
}

export const bold = colors.bold
