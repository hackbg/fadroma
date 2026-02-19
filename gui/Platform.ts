import Html    from '../library/Html.ts';
import Editor  from './Editor.ts';
import Feature from './Feature.ts';
import Icon    from './Icon.ts';
import { Link, elById, on } from './lib.ts';

export default Platforms;

function Platforms (
  sidebar  = elById("sidebar"),
  features = elById("features"),
) {
  on(features, "change", Editor.update);
  Html.append(features, Html(['p', 'Current and planned platform support:',]));
  Html.append(features, Html(['div.row.gap', ['ul.features',

    Platforms.Section({
      open: false,
      name: 'Bitcoin ecosystem',
      help: 'https://github.com/hackbg/fadroma/discussions/240',
      features: [
        [true, 0, "enable:btc",      "Bitcoin",
          ["Develop and test with local bitcoind in ", Link(urls.btcTest, "regtest"), " mode."],
          ["RPC", urls.btcRpc]],
        [true, 0, "enable:elements", "Elements",
          ["Develop and test with local elementsd in ", Link(urls.btcTest, "regtest"), " mode."],
          ["RPC", urls.btcRpc]],
        [true, 0, "enable:simf",     "SimplicityHL",
          ["Compile and run ", Link(urls.simfRef, "SimplicityHL"), " programs."],
          ["Language", urls.simfRef],
          ["Jets", urls.simfJets]]
      ]
    }),

    Platforms.Section({
      open: false,
      name: 'Solana ecosystem',
      help: 'https://github.com/hackbg/fadroma/discussions/237',
      features: [
        [false, 0, "enable:sol", "Solana", "Client for Solana.",
          ["Web3",   urls.solanaWeb3],
          ["Kit",    urls.solanaKit],
          ["Codama", urls.codama]],
        [false, 1, "enable:sol-prog", "Solana Rust",
          "Write programs for Solana.",
          ["Core",   urls.solanaCrate]],
        [false, 1, "enable:sol-prog", "Solana Anchor",
          "Framework for Solana programs.",
          ["IDL",    urls.idlGuide],
          ["Anchor", urls.anchorCrate]],
      ]
    }),

    Platforms.Section({
      open: false,
      name: 'Cosmos ecosystem',
      help: 'https://github.com/hackbg/fadroma/discussions/238',
      features: [
        [false, 0, "enable:tm", "Tendermint",
          "Client for Tendermint and compatibles."],
        [false, 1, "enable:namada", "Namada",
          ["Client and decoder for ", Link(urls.namadaRepo, "Namada"), "."]],
        [false, 1, "enable:scrt", "Scrt",
          ["Client for ", Link(urls.scrtHome, "Secret"), "."]],
        [false, 1, "enable:cw", "CosmWasm",
          "Write contracts for the Cosmos ecosystem."],
      ]
    }),

  ], ['ul.features', 

    Platforms.Section({
      open: false,
      name: 'JS / TS / ECMAScript ecosystem',
      help: 'https://github.com/hackbg/fadroma/discussions/239',
      features: [
        [true, 0, "enable:deno", "Deno",
          "Run on next-gen TS/JS runtime by default.",
          ["@std", urls.denoStd],
          ["API",  urls.denoApi]],
        [true, 0, "enable:node", "Node.js",
          ["Will use ", Link(urls.tsxNpm, "tsx"), " to run TypeScript."],
          ["API", urls.nodeApi]],
        [true, 0, "enable:pnpm", "PNPM",
          ["Recommended package manager."], ["Compare", urls.pnpmCompare]],
        [false, 0, "enable:eslint", "ESLint",
          "Static analyzer.", ["Platforms", urls.eslintConf]],
        [false, 0, "enable:vite",
          "Vite", "Build your front-end in the same repo."]
      ]
    }),

    Platforms.Section({
      open: false,
      name: 'Rust ecosystem',
      help: 'https://github.com/hackbg/fadroma/discussions/236',
      features: [
        [false, 0, "enable:rust", "Rust",
          "Different targets may need different toolchains."],
        [false, 0, "enable:mold", "Mold",
          "Improves build times."],
      ]
    }),

    Platforms.Section({
      open: false,
      name: 'DevOps / Unix ecosystem',
      help: 'https://github.com/hackbg/fadroma/discussions/categories/guides',
      features: [
        [true,  0, "enable:git",          "Git",
          "Automatically init Git repo in new project."],
        [true,  0, "enable:nix",          "Nix Shell",
          ["Obtain dependencies from ", Link(urls.nixPkgs, "nixpkgs")],
          ["Install", urls.nixInstall]],
        [true,  0, "enable:direnv",       "Direnv",
          ["Automatically load Nix shell when entering project directory."],
          ["Wiki", urls.direnvWiki]],
        [false, 0, "enable:editorconfig", "EditorPlatforms",
          "IDE-agnostic settings.",
          ["Spec", urls.edConfSpec]],
      ]
    }),

    Platforms.Section({
      open: false,
      name: 'CI / CD',
      help: 'https://github.com/hackbg/fadroma/discussions/categories/guides',
      features: [
        [false, 0, "enable:gha",          "GHA",
          "Platforms for GitHub Actions."],
        [false, 0, "enable:drone",        "Drone",
          "Platforms for Drone CI."],
        [false, 0, "enable:woodpecker",   "Woodpecker",
          "Platforms for Woodpecker CI."],
      ]
    }),

  ]]));
  return sidebar;
}

namespace Platforms {
  export function Section ({
    open = false,
    name = '',
    help = null as string,
    features = [] as Array<[boolean, number, string, ...unknown[]]>
  }) {
    return ['details', { open },
      ['summary', name, (help ? ['a.help', { target: '_blank', href: help }, Icon('github')] : '')],
      ['ul.features', ...features.map(
        ([enabled, n, name, ...rest])=>(((!enabled) ? Feature.Disabled : Feature)(n, name, ...rest))
      )]
    ];
  }
}

export const urls = {
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
};

