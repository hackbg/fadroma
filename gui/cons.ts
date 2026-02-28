import Html from '../library/Html.ts';

export const Texts = {
  CONNECTED:     '⬤ Connected to ',
  CONNECTING:    '◯ Connecting to ',
  CONNECT_ERROR: '◯ Error, reconnecting to ',
  SIMPLICITYHL:  ['div', ['h2', 'Now with SimplicityHL Support!'],
    ['p', ['a', { href: 'https://github.com/hackbg/simf/blob/dev/src/lib.rs' }, ['strong', 'Fadroma V3'], ' uses WebAssembly'],
      ' to instantly compile, evaluate, and deploy ', ['a', { href: 'https://docs.simplicity-lang.org/getting-started/simplicityhl/' }, ['strong', 'SimplicityHL'], ' smart contracts'],
      ' on ', ['a', { href: 'https://liquid.net/'}, 'the ', ['strong', 'Liquid'], ' Network'], '. It works from all modern JavaScript-based environments: browsers, servers, ', ['a', { href: 'https://deno.com/deploy' }, 'edge cloud'], ' — even this webpage!'],
    ['p', 'The ', ['strong', 'Simplicity transaction lifecycle'], ' works in two phases. During the ', ['strong', 'commitment phase'], ' you ',
      ' take a SimplicityHL program, provide parameters, compile it to a P2TR address on a given chain, and commit funds to that address. ',
      'During the ', ['strong', 'redemption phase'], ' you compose a transaction that redeems the funds, and provide a matching signature ',
      'that fulfills the conditions of the program.'],
    ['p', 'Try it now with these ', ['strong', 'SimplicityHL programs'], ' on ', ['a', { href: 'https://blockstream.info/liquidtestnet/' }, 'Liquid Testnet'], ':']],
  README:          'Created at https://fadroma.tech',
  NO_DEPLOYS:      'Deploy a program first, using the above form.',
  DownloadProject: ['p', 'Here you can ', ['strong', 'download an example project'], ' containing the example programs and the following support files:'],
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

export const Labels = { // FIXME merge into Texts
  compile: "Compile",
  commit:  "Commit",
  redeem:  "Redeem",
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
  elementsRpc: "https://elementsproject.org/en/doc/23.2.1/rpc/",
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

export function Platforms (
  sidebar  = Html.id("sidebar"),
  features = Html.id("features"),
) {
  Html.on(features, "change", Platforms.updateProjectConfiguration);
  Html.append(features, Platforms.Platforms1());
  Html.append(features, Platforms.Platforms2());
  return sidebar;
}

export namespace Platforms {

  export function updateProjectConfiguration (e: InputEvent) {
    let target = e.target as HTMLElement;
    do {
      if (target?.id?.startsWith('enable:')) {
        console.log(target.id);
        return;
      }
      target = target.parentElement;
    } while (
      target && target !== e.currentTarget
    );
  }

  export function Section ({
    open = true,
    name = '',
    help = null as string,
    features = [] as Array<[boolean, number, string, ...unknown[]]>
  }) {
    return ['details', { open },
      ['summary', name, (help ? ['a.help', { target: '_blank', href: help }, 'Discuss ', Icon('github')] : '')],
      ['ul.features', ...features.map(
        ([enabled, n, name, ...rest])=>(((!enabled) ? Feature.Disabled : Feature)(n, name, ...rest))
      )]
    ];
  }

  export function Platforms1 () {
    return Html(['ul.features',
      Platforms.Section({
        //open: false,
        name: 'Bitcoin ecosystem',
        help: 'https://github.com/hackbg/fadroma/discussions/240',
        features: [
          [true, 0, "enable:btc",      "Bitcoin",
            ["Develop and test with local bitcoind in ", Link(Urls.btcTest, ['code', "regtest"]), " mode."],
            ["RPC", Urls.btcRpc]],
          [true, 0, "enable:elements", "Elements",
            ["Develop and test with local elementsd in ", ['code', "elementsregtest"], " mode."],
            ["RPC", Urls.elementsRpc]],
          [true, 0, "enable:simf",     "SimplicityHL",
            ["Compile and run ", Link(Urls.simfRef, "SimplicityHL"), " programs."],
            ["Language", Urls.simfRef],
            ["Jets", Urls.simfJets]]
        ]
      }),
      Platforms.Section({
        //open: false,
        name: 'Solana ecosystem',
        help: 'https://github.com/hackbg/fadroma/discussions/237',
        features: [
          [false, 0, "enable:sol", "Solana", "Connect to Solana.",
            ["Web3",   Urls.solanaWeb3],
            ["Kit",    Urls.solanaKit]],
          [false, 1, "enable:sol-prog", "Solana Programs",
            "Write Solana programs in Rust.",
            ["Core",   Urls.solanaCrate],
            ["Codama", Urls.codama]],
          [false, 1, "enable:sol-idl", "Solana Anchor IDL",
            "Integrate with Solana Anchor IDL.",
            ["IDL",    Urls.idlGuide],
            ["Anchor", Urls.anchorCrate]],
        ]
      }),
      Platforms.Section({
        //open: false,
        name: 'Cosmos ecosystem',
        help: 'https://github.com/hackbg/fadroma/discussions/238',
        features: [
          [false, 0, "enable:tm", "Tendermint",
            "Connect to for Tendermint, CometBFT, and compatibles."],
          [false, 1, "enable:namada", "Namada",
            ["Client and decoder for ", Link(Urls.namadaRepo, "Namada"), "."]],
          [false, 1, "enable:scrt", "Scrt",
            ["Client for ", Link(Urls.scrtHome, "Secret"), "."]],
          [false, 1, "enable:cw", "CosmWasm",
            "Write contracts for the Cosmos ecosystem."],
        ]
      }),
    ])
  }

  export function Platforms2 () {
    return Html(['ul.features',
      Platforms.Section({
        //open: false,
        name: 'DevOps / Unix ecosystem',
        help: 'https://github.com/hackbg/fadroma/discussions/categories/guides',
        features: [
          [true,  0, "enable:git",          "Git",
            "Automatically init Git repo in new project."],
          [true,  0, "enable:nix",          "Nix Shell",
            ["Obtain dependencies from ", Link(Urls.nixPkgs, "nixpkgs")],
            ["Install", Urls.nixInstall]],
          [true,  0, "enable:direnv",       "Direnv",
            ["Automatically load Nix shell when entering project directory."],
            ["Wiki", Urls.direnvWiki]],
          [false, 0, "enable:editorconfig", "EditorConfig",
            "IDE-agnostic settings.",
            ["Spec", Urls.edConfSpec]],
        ]
      }),
      Platforms.Section({
        //open: false,
        name: 'JS / TS / ECMAScript ecosystem',
        help: 'https://github.com/hackbg/fadroma/discussions/239',
        features: [
          [true, 0, "enable:deno", "Deno",
            "Run on next-gen TS/JS runtime by default.",
            ["@std", Urls.denoStd],
            ["API",  Urls.denoApi]],
          [true, 0, "enable:node", "Node.js",
            ["Will use ", Link(Urls.tsxNpm, "tsx"), " to run TypeScript."],
            ["API", Urls.nodeApi]],
          [true, 0, "enable:pnpm", "PNPM",
            ["Recommended package manager."], ["Compare", Urls.pnpmCompare]],
          [false, 0, "enable:eslint", "ESLint",
            "Static analyzer.", ["Platforms", Urls.eslintConf]],
          [false, 0, "enable:vite",
            "Vite", "Build your front-end in the same repo."]
        ]
      }),
      Platforms.Section({
        //open: false,
        name: 'Rust ecosystem',
        help: 'https://github.com/hackbg/fadroma/discussions/236',
        features: [
          [false, 0, "enable:mold", "Mold", "Improves build times."],
          [false, 0, "enable:rust", "Rust", "Different targets may need different toolchains."],
        ]
      }),
      //Platforms.Section({
        ////open: false,
        //name: 'CI / CD',
        //help: 'https://github.com/hackbg/fadroma/discussions/categories/guides',
        //features: [
          //[false, 0, "enable:gha",          "GHA",
            //"Setup for GitHub Actions."],
          //[false, 0, "enable:drone",        "Drone",
            //"Setup for Drone CI."],
          //[false, 0, "enable:woodpecker",   "Woodpecker",
            //"Setup for Woodpecker CI."],
        //]
      //}),
    ])
  }

}

export function Feature (
  depth: number,
  id: string,
  name = ``,
  description = `` as string|(unknown[]),
  ...links: [string, string?][]
) {
  return Html([`li.feature[data-depth=${depth}]`,
    ['div.row.between',
      ['div.col', [`label`, [`input[type=checkbox][checked=checked]`, { id }], name],
        ['p.grow', ...(typeof description === 'object')?description:[description]]],
      Feature.Links(links)]]);
}

export namespace Feature {

  export function Disabled (
    depth:       number,
    id:          string,
    name:        string = ``,
    description: string|(unknown[]) = ``,
    ...links:   [string, string?][]
  ) {
    return Html([`li.feature.disabled[data-depth=${depth}]`,
      ['div.row.between',
        ['div.col', [`label`, [`input[type=checkbox][disabled=disabled]`, { id }], name],
          ['p.grow', ...(typeof description === 'object')?description:[description]]],
        Feature.Links(links)]]);
  }

  export function Links (
    links: [string, string?][]
  ) {
    return ['div.links', ...links.map(([text, href = '#'])=>
      ['a.flex[target=_blank]', { href }, text, Icon("book")])]
  };
}

export function Link (href: string, ...text: unknown[]) {
  return ['a[target=_blank]', { href }, ...text];
}
export function Icon (name: string) {
  return ['svg.icon', [`use[href=icons.svg#${name}]`]]
}
export namespace Icon {
  // preset icons
}
