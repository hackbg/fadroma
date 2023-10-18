import { testEntrypoint } from '@hackbg/ensuite'

export default testEntrypoint(import.meta.url, {
  'docs': () => import('../spec/Connect.spec.ts.md'),
})

