import { DOM } from '../lib/index.ts';
import { Link, Icon, elById, append } from './lib.ts';
import { urls } from './urls.ts';

export function initFeatures (el = elById("features")) {
  return append(el,
    Feature("enable.btc", "Bitcoin",
      ["Test with local bitcoind in ", Link(urls.btcTest, "regtest"), " mode."],
      ["RPC", urls.btcRpc]),

    DisabledFeature("enable.sol", "Solana", "Client for Solana.",
      ["Web3",   urls.solanaWeb3],
      ["Kit",    urls.solanaKit],
      ["Codama", urls.codama]),

    DisabledFeature("enable.tm", "Tendermint",
      "Client for Tendermint and compatibles."),

    DisabledFeature("enable.namada", "Namada",
      ["Client and decoder for ", Link(urls.namadaRepo, "Namada"), "."]),

    DisabledFeature("enable.scrt", "Scrt",
      ["Client for ", Link(urls.scrtHome, "Secret"), "."]),

    Feature("enable.simf", "Simplicity",
      ["Compile and run ", Link(urls.simfRef, "SimplicityHL"), " programs on Bitcoin."],
      ["Language", urls.simfRef],
      ["Jets", urls.simfJets]),

    DisabledFeature("enable.rust", "Rust",  "Different targets may need different toolchains."),

    DisabledFeature("enable.mold", "Mold",  "Improves build times."),

    DisabledFeature("enable.sol-prog", "Solana Rust",
      "Write programs for Solana.",
      ["Core",   urls.solanaCrate]),

    DisabledFeature("enable.sol-prog", "Solana Anchor",
      "Write programs for Solana with bells and whistles.",
      ["IDL",    urls.idlGuide],
      ["Anchor", urls.anchorCrate]),

    DisabledFeature("enable.cw", "CosmWasm", "Write contracts for the Cosmos ecosystem."),

    Feature("enable.deno", "Deno",
      ["Next-gen TS/JS runtime."],
      ["@std", urls.denoStd],
      ["API",  urls.denoApi]),

    Feature("enable.node", "Node.js",
      ["Will use ", Link(urls.tsxNpm, "tsx"), " to run TypeScript."],
      ["API", urls.nodeApi]),

    Feature("enable.pnpm", "PNPM",
      ["Recommended package manager."],
      ["Compare", urls.pnpmCompare]),

    DisabledFeature("enable.eslint", "ESLint", "Static analyzer.",
      ["Config", urls.eslintConf]),

    Feature("enable.nix", "Nix Shell",
      ["Obtain dependencies from ", Link(urls.nixPkgs, "nixpkgs")],
      ["Install", urls.nixInstall]),

    Feature("enable.direnv", "Direnv",
      ["Automatically load Nix shell when entering project directory."],
      ["Wiki", urls.direnvWiki]),

    DisabledFeature("enable.editorconfig", "EditorConfig",
      "IDE-agnostic settings.",
      ["Spec", urls.edConfSpec]),

    DisabledFeature("enable.gha",   "GHA",   "Config for GitHub Actions."),

    DisabledFeature("enable.drone", "Drone", "Config for Drone CI."),

  );
}

export function Feature (
  id, name = ``, description = `` as string|(unknown[]), ...links
) {
  return DOM([`li.feature`,
    [`label`, [`input[type=checkbox][checked=checked]`, { id }], name],
    ['p.grow', ...(typeof description === 'object')?description:[description]],
    ['div.row.links', ...links.map(([text, href = '#'])=>
      ['a.flex[target=_blank]', { href }, Icon("book"), text])]])
}

export function DisabledFeature (
  id, name = ``, description = `` as string|(unknown[]), ...links
) {
  return DOM([`li.feature.disabled`,
    [`label`, `⏳️  ${name}`],
    ['p.grow', ...(typeof description === 'object')?description:[description]],
    ['div.row.links', ...links.map(([text, href = '#'])=>
      ['a.flex[target=_blank]', { href }, Icon("book"), text])]])
}
