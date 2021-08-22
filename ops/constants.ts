import { resolve, dirname, fileURLToPath, cwd } from './system'

export const __dirname = dirname(fileURLToPath(import.meta.url))

export const defaultStateBase = resolve(cwd(), 'artifacts')
