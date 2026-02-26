export const Texts = {
  CONNECTED:     '⬤ Connected to ',
  CONNECTING:    '◯ Connecting to ',
  CONNECT_ERROR: '◯ Error, reconnecting to ',

  Welcome:         ['p', ['strong', 'Fadroma V3'], ' employs WebAssembly to instantly compile, evaluate, and deploy ', ['strong', 'SimplicityHL smart contracts'], ' from modern JavaScript-based environments: browsers, servers, and edge services.'],
  Examples:        ['div.grow', 'Try these ', ['strong', 'SimplicityHL programs'], ' on ', ['a', { href: 'https://blockstream.info/liquidtestnet/' }, 'Liquid Testnet:'], ' '],
  Phases:          ['p', 'The ', ['strong', 'Simplicity transaction lifecycle'], ' happens in two phases:' ],
  CommitmentPhase: ['p', ['span', ['strong', Dropcap('A. '), 'Commitment phase'], '. Compile program to P2TR address, and fund it on-chain:']],
  RedemptionPhase: ['p', ['span', ['strong', Dropcap('B. '), 'Redemption phase'], '. Fulfill the program\'s conditions to redeem funds:']],
  DownloadProject: ['p', 'Here you can ', ['strong', 'download an example project'], ' containing the above programs and the following support files:'],
  CompileTitle:    ['span', ['strong', ['span', { style: 'float:left;font-size:1.5rem;padding-right:0.33rem' }, '1. '], 'Compile program'], ' to P2TR address:'],
  FundTitle:       ['span', ['strong', ['span', { style: 'float:left;font-size:1.5rem;padding-right:0.33rem' }, '2. '], 'Send funds'], ' to the program\'s address:'],
  WitnessTitle:    ['span', ['strong', ['span', { style: 'float:left;font-size:1.5rem;padding-right:0.33rem' }, '3. '], 'Specify transaction'], ' to obtain SIGHASH_ALL:'],
  RedeemTitle:     ['span', ['strong', ['span', { style: 'float:left;font-size:1.5rem;padding-right:0.33rem' }, '4. '], 'Receive funds'], ' by sending valid signatures:'],
  //['p.smol', ['strong', 'Local dev dependencies'], ' can be provided by Nix and Direnv (or bring your own Deno, Just and Elements.).'],
  //ES.DenoJsonField(deno),
  //PackageJsonField({ node, vite }),
  //TsConfigField(),
  //['p.smol', ['strong', 'Fast integration testing'], ' on ', ['code', 'elementsregtest'],
    //' and ', ['code', 'liquidtestnet'], ' out of the box:'],
} as const;

export const Urls = {
  anchorCrate: "https://docs.rs/anchor-lang/latest/anchor_lang/",
  btcRpc:      "https://en.bitcoin.it/wiki/Original_Bitcoin_client/API_calls_list",
  btcTest:     "https://developer.bitcoin.org/examples/testing.html",
  codama:      "#",
  denoApi:     "https://docs.deno.com/api/deno/",
  denoStd:     "https://docs.deno.com/runtime/reference/std/",
  direnvWiki:  "https://github.com/direnv/direnv/wiki",
  edConfSpec:  "https://spec.editorconfig.org/",
  eslintConf:  "https://eslint.org/docs/latest/use/configure/",
  idlGuide:    "https://solana.com/developers/guides/advanced/idls",
  namadaRepo:  "https://github.com/namada-net/namada",
  nixInstall:  "https://nixos.org/download/",
  nixPkgs:     "https://search.nixos.org/packages",
  nodeApi:     "https://nodejs.org/api/index.html",
  pnpmCompare: "https://pnpm.io/feature-comparison",
  scrtHome:    "https://scrt.network/",
  simfJets:    "https://docs.rs/simfony-as-rust/latest/simfony_as_rust/jet/index.html",
  simfRef:     "https://docs.simplicity-lang.org/simplicityhl-reference/",
  solanaCrate: "https://docs.rs/solana-program/latest/solana_program/",
  solanaKit:   "#",
  solanaWeb3:  "#",
  tsxNpm:      "https://www.npmjs.com/package/tsx",
} as const;

/** Shout out. */
function Dropcap (...content) {
  return ['span', { style: 'float:left;font-size:2rem;padding-right:0.33rem' }, ...content]
}
