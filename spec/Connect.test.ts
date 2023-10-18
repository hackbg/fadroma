import testEntrypoint from './testSelector'
export default testEntrypoint(import.meta.url, {
  'docs': () => import('./Connect.spec.ts.md'),
})
