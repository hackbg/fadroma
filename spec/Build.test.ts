import testEntrypoint from './testSelector'
export default testEntrypoint(import.meta.url, {
  'docs': () => import('./Build.spec.ts.md'),
})
