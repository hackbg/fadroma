import { writeFile } from 'fs/promises'

export default function markdownTable (header) {
  const rows = [ header, header.map((()=>'---')) ]
  return {
    push (row) {
      rows.push(row)
    },
    total () {
      const sum = col => rows.slice(2).map(x=>x[col]).reduce((x,y)=>(x||0)+(y||0), 0)
      rows.push(["", '**total**', sum(2), sum(3), sum(4)])
    },
    write (file) {
      this.total()
      const data = rows.filter(Boolean).map(row=>`| `+row.join(' | ')+` |`).join('\n')
      return writeFile(file, data, 'utf8')
    }
  }
}
