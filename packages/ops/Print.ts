import { bold } from '@hackbg/fadroma'
import type { Uploads } from './Upload'

/** List of code blobs in human-readable form */
export function generateUploadsTable (uploads: Uploads) {

  const rows = []

  rows.push([bold('  code id'), bold('name\n'), bold('size'), bold('hash')])

  if (uploads.exists()) {
    for (const name of uploads.list()) {
      const {
        codeId,
        originalSize,
        compressedSize,
        originalChecksum,
        compressedChecksum,
      } = uploads.load(name)
      rows.push([
        `  ${codeId}`,
        `${bold(name)}\ncompressed:\n`,
        `${originalSize}\n${String(compressedSize).padStart(String(originalSize).length)}`,
        `${originalChecksum}\n${compressedChecksum}`
      ])
    }
  }

  return rows.sort((x,y)=>x[0]-y[0])

}

export function printIdentities (chain: any) {
  console.log('\nAvailable identities:')
  for (const identity of chain.identities.list()) {
    console.log(`  ${chain.identities.load(identity).address} (${bold(identity)})`)
  }
}
