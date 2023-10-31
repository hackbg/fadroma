/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { bip39, bip39EN } from '@fadroma/connect'
import $, { TextFile } from '@hackbg/file'
import Case from 'case'
import type { Project } from './project'

export function writeProject ({
  name, root, dirs, files, crates
}: Project) {

  // Create project root 
  root.make()

  // Create project directories
  Object.values(dirs).forEach(dir=>dir.make())

  // Project files that we will populate:
  const {
    readme, packageJson, cargoToml,
    gitignore, envfile, shellNix,
    apiIndex, projectIndex, testIndex,
  } = files

  // Populate readme
  readme.save([
    `# ${name}\n---\n`,
    `Powered by [Fadroma](https://fadroma.tech) `,
    `by [Hack.bg](https://hack.bg) `,
    `under [AGPL3](https://www.gnu.org/licenses/agpl-3.0.en.html).`
  ].join(''))

  // Populate NPM dependencies
  packageJson.save({
    name: `${name}`,
    main: `index.ts`,
    type: "module",
    version: "0.1.0",
    dependencies: {
      "@fadroma/agent":  "1.1.2",
      "@fadroma/scrt":   "10.1.6",
      "secretjs":        "1.9.3"
    },
    devDependencies: {
      "@hackbg/fadroma": `1.5.9`,
      "@hackbg/ganesha": "4.2.0",
      //"@hackbg/ubik":    "^2.0.0",
      "typescript":      "^5.1.6",
    },
    scripts: {
      "build":   "fadroma build",
      "rebuild": "fadroma rebuild",
      "status":  "fadroma status",
      "mocknet": `FADROMA_PROJECT=./fadroma.config.ts FADROMA_CHAIN=Mocknet fadroma`,
      "devnet":  `FADROMA_PROJECT=./fadroma.config.ts FADROMA_CHAIN=ScrtDevnet fadroma`,
      "testnet": `FADROMA_PROJECT=./fadroma.config.ts FADROMA_CHAIN=ScrtTestnet fadroma`,
      "mainnet": `FADROMA_PROJECT=./fadroma.config.ts FADROMA_CHAIN=ScrtMainnet fadroma`,
      "test":         `FADROMA_PROJECT=./fadroma.config.ts fadroma run test.ts`,
      "test:mocknet": `FADROMA_PROJECT=./fadroma.config.ts FADROMA_CHAIN=Mocknet fadroma run test.ts`,
      "test:devnet":  `FADROMA_PROJECT=./fadroma.config.ts FADROMA_CHAIN=ScrtDevnet fadroma run test.ts`,
      "test:testnet": `FADROMA_PROJECT=./fadroma.config.ts FADROMA_CHAIN=ScrtTestnet fadroma run test.ts`,
    },
  })

  // Define api module
  let deploymentClassName =
    (Object.keys(templates).includes(name))
      ? `${Case.pascal(name)}Deployment`
      : Case.pascal(name)

  apiIndex.save([
    `import { Client, Deployment } from '@fadroma/agent'`,
    [
      `export default class ${deploymentClassName} extends Deployment {`,
      ...Object.keys(templates).map(name => [
        ``, `  ${Case.camel(name)} = this.contract({`,
        `    name: "${name}",`,
        `    crate: "${name}",`,
        `    client: ${Case.pascal(name)},`,
        `    initMsg: async () => ({})`,
        `  })`
      ].join('\n')),
      '',
      `  // Define your contract roles here with:`,
      `  //   contract = this.contract({...})`, `  //`,
      `  // See https://fadroma.tech/deploy.html`,
      `  // for more info about how to populate this section.`,
      '',
      '}',
    ].join('\n'),
    ...Object.keys(templates).map(x=>Case.pascal(x)).map(Contract => [
      `export class ${Contract} extends Client {`,
      `  // Implement methods calling the contract here:`, `  //`,
      `  // myTx = (arg1, arg2) => this.execute({my_tx:{arg1, arg2}})`,
      `  // myQuery = (arg1, arg2) => this.query({my_query:{arg1, arg2}})`, `  //`,
      `  // See https://fadroma.tech/agent.html#client`,
      `  // for more info about how to populate this section.`,
      `}\n`
    ].join('\n'))
  ].join('\n\n'))

  // Define ops module
  projectIndex.save([
    [
      `import ${Case.pascal(name)} from './api'`,
      `import Project from '@hackbg/fadroma'`,
    ].join('\n'),
    [
      `export default class ${Case.pascal(name)}Project extends Project {`, ``,
      `  Deployment = ${Case.pascal(name)}`, ``,
      `  // Override to customize the build command:`, `  //`,
      `  // build = async (...contracts: string[]) => { `,
      `  //   await super.build(...contracts)`,
      `  // }`, ``,
      `  // Override to customize the upload command:`, `  //`,
      `  // upload = async (...contracts: string[]) => {`,
      `  //   await super.upload(...contracts)`,
      `  // }`, ``,
      `  // Override to customize the deploy command:`,
      `  //`,
      `  // deploy = async (...args: string[]) => {`,
      `  //   await super.deploy(...args)`,
      `  // }`, ``,
      `  // Override to customize the status command:`, `  //`,
      `  // status = async (...args: string[]) => {`,
      `  //   await super.status()`,
      `  // }`, ``,
      `  // Define custom commands using \`this.command\`:`, `  //`,
      `  // custom = this.command('custom', 'run a custom procedure', async () => {`,
      `  //   // ...`,
      `  // })`,
      ``, `}`
    ].join('\n')
  ].join('\n\n'))

  // Define test module
  testIndex.save([
    `import * as assert from 'node:assert'`,
    `import ${Case.pascal(name)} from './api'`,
    `import { getDeployment } from '@hackbg/fadroma'`,
    `const deployment = await getDeployment(${Case.pascal(name)}).deploy()`,
    `// add your assertions here`
  ].join('\n'))

  // Populate gitignore
  gitignore.save([
    '.env',
    '*.swp',
    'node_modules',
    'target',
    'state/*',
    '!state/secret-1',
    '!state/secret-2',
    '!state/secret-3',
    '!state/secret-4',
    '!state/pulsar-1',
    '!state/pulsar-2',
    '!state/pulsar-3',
    '!state/okp4-nemeton-1',
    'wasm/*',
    '!wasm/*.sha256',
  ].join('\n'))

  // Populate env config
  envfile.save([
    '# FADROMA_MNEMONIC=your mainnet mnemonic',
    `FADROMA_TESTNET_MNEMONIC=${bip39.generateMnemonic(bip39EN)}`,
    ``,
    `# Just remove these two when pulsar-3 is ready:`,
    `FADROMA_SCRT_TESTNET_CHAIN_ID=pulsar-2`,
    `FADROMA_SCRT_TESTNET_URL=https://lcd.testnet.secretsaturn.net`,
    ``,
    `# Other settings:`,
  ].join('\n'))

  // Populate Nix shell
  shellNix.save([
    `{ pkgs ? import <nixpkgs> {}, ... }: let name = "${name}"; in pkgs.mkShell {`,
    `  inherit name;`,
    `  nativeBuildInputs = with pkgs; [`,
    `    git nodejs nodePackages_latest.pnpm rustup`,
    `    binaryen wabt wasm-pack wasm-bindgen-cli`,
    `  ];`,
    `  shellHook = ''`,
    `    export PS1="$PS1[\${name}] "`,
    `    export PATH="$PATH:$HOME/.cargo/bin:\${./.}/node_modules/.bin"`,
    `  '';`,
    `}`,
  ].join('\n'))

  // Populate root Cargo.toml
  cargoToml.as(TextFile).save([
    `[workspace]`, `resolver = "2"`, `members = [`,
    Object.values(crates).map(crate=>`  "src/${crate.name}"`).sort().join(',\n'),
    `]`
  ].join('\n'))

  // Create each crate and store a null checksum for it
  const sha256 = '000000000000000000000000000000000000000000000000000000000000000'
  Object.values(crates).forEach(crate=>{
    crate.create()
    const name = `${crate.name}@HEAD.wasm`
    dirs.wasm.at(`${name}.sha256`).as(TextFile).save(`${sha256}  *${name}`)
  })

}
