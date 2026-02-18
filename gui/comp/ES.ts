import { Fields } from './Field.ts';

export namespace ES {

  export function Import (mod: string, ...items: (string|false|null)[]) {
    items = items.filter(x=>(typeof x === 'string'))
    if (items.length > 0) {
      return `import { ${items.join(', ')} } from "${mod}";`
    } else {
      return ''
    }
  }

  export const HashBang = ({ deno = false, node = false }) =>
    deno ? `#!/usr/bin/env -S deno run -I --coverage --allow-env --allow-run --allow-net\n` :
    node ? `#!/usr/bin/env -S npx tsx\n` :
    null;

  export const TestSuite = ({ deno, node, btc } = {}) => Fields.TS("test.ts",
      ES.HashBang({ deno, node }),
      ES.Import("@hackbg/fadroma", btc && 'Btc', 'Test'),
      `import Program from './index.ts';`,
      `export default Test.suite(import.meta, Btc(`,
      `  Test.the("Build",    Program.build),`,
      `  Test.the("Deposit",  Program.deposit),`,
      `  Test.the("Withdraw", Program.withdraw)));`)
}

export const DenoJsonField = deno => deno && Fields.Text("deno.json", "{}");

export const PackageJsonField = ({ node, vite }) => Fields.Text("package.json", `{`,
  `  "name":    "untitled",`,
  `  "type":    "module",`,
  `  "main":    "index.ts",`,
  `  "version": "0.1.0",`,
  `  "licence": "AGPL-3.0-or-later",`,
  `  "dependencies": {`,
  `    "@hackbg/fadroma": "https://github.com/hackbg/fadroma.git#v3-alpha"`,
  `  },`,
  `  "devDependencies": {`, [
    (node && `    "tsx":  "^4.20.6"`),
    (vite && `    "vite": "^7.2.2"`),
  ].filter(Boolean).join(',\n'),
  `  }`,
  `}`,
);

export const TsConfigField = () => Fields.Text("tsconfig.json", `{`,
  `  "compilerOptions": {`,
  `    "strict":                    false,`,
  `    "target":                    "esnext",`,
  `    "module":                    "esnext",`,
  `    "moduleResolution":          "bundler",`,
  `    "allowImportingTsExtensions": true,`,
  `    "noUnusedLocals":             false,`,
  `    "noUnusedParameters":         false,`,
  `    "isolatedModules":            false`,
  `  }`,
  `}`,
);
