import { writeFile } from 'fs/promises'
export function markdownTable (header: Array<string>) {
  const rows = [ header, header.map((()=>'---')) ]
  return {
    push (row:any) {
      rows.push(row) },
    total () {
      const sum = (col:any) => rows
        .slice(2)
        .map(x=>x[col])
        .reduce((x:any,y:any)=>(x||0)+(y||0), 0)
      rows.push(["", '**total**', sum(2), sum(3), sum(4)]) },
    write (file:any) {
      this.total()
      const data = rows.filter(Boolean).map(row=>`| `+row.join(' | ')+` |`).join('\n')
      return writeFile(file, data, 'utf8') } } }

import { table, getBorderCharacters } from 'table'
export { table, getBorderCharacters }
export const noBorders = {
  border: getBorderCharacters('void'),
  columnDefault: { paddingLeft: 0, paddingRight: 2 },
  drawHorizontalLine: () => false }
