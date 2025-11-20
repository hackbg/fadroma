import { DOM } from '../lib/index.ts';
import { on, elById, Link, Icon } from './lib.ts';
import { urls } from './urls.ts';
import { updateProject } from './edit.ts';

export const Features = Object.assign(function initFeatures (
  el = elById("features")
) {
  on(el, "change", updateProject);
  DOM.append(el, ...Features.Btc());
  DOM.append(el, ...Features.Ecma());
  DOM.append(el, ...Features.Env());
  DOM.append(el, ...Features.Rust());
  DOM.append(el, ...Features.Sol());
  DOM.append(el, ...Features.Tm());
  DOM.append(el, ...Features.Ci());
  return el;
}, {

  Btc: () => [
    Feature(0, "enable:btc", "Bitcoin",
      ["Test with local bitcoind in ", Link(urls.btcTest, "regtest"), " mode."],
      ["RPC", urls.btcRpc]),
    Feature(1, "enable:simf", "Simplicity",
      ["Compile and run ", Link(urls.simfRef, "SimplicityHL"), " programs on Bitcoin."],
      ["Language", urls.simfRef],
      ["Jets", urls.simfJets]),
  ],

  Ecma: () => [
    Feature(0, "enable:js", "ECMAScript",
      "JavaScript/TypeScript SDK."),
    Feature(1, "enable:deno", "Deno",
      ["Next-gen TS/JS runtime."],
      ["@std", urls.denoStd],
      ["API",  urls.denoApi]),
    Feature(1, "enable:node", "Node.js",
      ["Will use ", Link(urls.tsxNpm, "tsx"), " to run TypeScript."],
      ["API", urls.nodeApi]),
    Feature(1, "enable:pnpm", "PNPM",
      ["Recommended package manager."],
      ["Compare", urls.pnpmCompare]),
    Feature.Disabled(1, "enable:eslint", "ESLint", "Static analyzer.",
      ["Config", urls.eslintConf]),
    Feature.Disabled(1, "enable:vite", "Vite", "Front-end bundler."),
  ],

  Env: () => [
    Feature(0, "enable:environment", "Environment",
      "DX enhancements for the discerning terminal dweller."),
    Feature(1, "enable:nix", "Nix Shell",
      ["Obtain dependencies from ", Link(urls.nixPkgs, "nixpkgs")],
      ["Install", urls.nixInstall]),
    Feature(1, "enable:direnv", "Direnv",
      ["Automatically load Nix shell when entering project directory."],
      ["Wiki", urls.direnvWiki]),
    Feature.Disabled(1, "enable:editorconfig", "EditorConfig",
      "IDE-agnostic settings.",
      ["Spec", urls.edConfSpec]),
    Feature.Disabled(1, "enable:scripts", "Scripts",
      "Shell scripts under bin/ for common tasks."),
  ],

  Rust: () => [
    Feature.Disabled(0, "enable:rust", "Rust",
      "Different targets may need different toolchains."),
    Feature.Disabled(1, "enable:mold", "Mold",
      "Improves build times."),
  ],

  Sol: () => [
    Feature.Disabled(0, "enable:sol", "Solana", "Client for Solana.",
      ["Web3",   urls.solanaWeb3],
      ["Kit",    urls.solanaKit],
      ["Codama", urls.codama]),
    Feature.Disabled(1, "enable:sol-prog", "Solana Rust",
      "Write programs for Solana.",
      ["Core",   urls.solanaCrate]),
    Feature.Disabled(1, "enable:sol-prog", "Solana Anchor",
      "Framework for Solana programs.",
      ["IDL",    urls.idlGuide],
      ["Anchor", urls.anchorCrate]),
  ],

  Tm: () => [
    Feature.Disabled(0, "enable:tm", "Tendermint",
      "Client for Tendermint and compatibles."),
    Feature.Disabled(1, "enable:namada", "Namada",
      ["Client and decoder for ", Link(urls.namadaRepo, "Namada"), "."]),
    Feature.Disabled(1, "enable:scrt", "Scrt",
      ["Client for ", Link(urls.scrtHome, "Secret"), "."]),
    Feature.Disabled(1, "enable:cw", "CosmWasm",
      "Write contracts for the Cosmos ecosystem."),
  ],

  Ci: () => [
    Feature.Disabled(0, "enable:ci", "CI",
      "Automated verification workflous."),
    Feature.Disabled(1, "enable:gha",   "GHA",
      "Config for GitHub Actions."),
    Feature.Disabled(1, "enable:drone", "Drone",
      "Config for Drone CI."),
  ],

});

export const Feature = Object.assign(function initFeature (
  depth, id, name = ``, description = `` as string|(unknown[]), ...links: [string, string?][]
) {
  return DOM([`li.feature[data-depth=${depth}]`,
    ['div.row.between',
      [`label`, [`input[type=checkbox][checked=checked]`, { id }], name],
      Feature.Links(links)],
    ['p.grow', ...(typeof description === 'object')?description:[description]]
  ]);
}, {

  Disabled: function DisabledFeature (
    depth:       number,
    id:          string,
    name:        string = ``,
    description: string|(unknown[]) = ``,
    ...links:   [string, string?][]
  ) {
    return DOM([`li.feature.disabled[data-depth=${depth}]`,
      ['div.row.between', [`label`, `⏳️  ${name}`], Feature.Links(links)],
      ['p.grow', ...(typeof description === 'object')?description:[description]]]);
  },

  Links (
    links: [string, string?][]
  ) {
    return ['div.row.links', ...links.map(([text, href = '#'])=>
      ['a.flex[target=_blank]', { href }, Icon("book"), text])]
  },

});
