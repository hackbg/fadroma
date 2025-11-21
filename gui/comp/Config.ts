import { DOM } from '../../lib/index.ts';
import { on, elById, Link } from '../lib.ts';
import { urls } from '../urls.ts';
import { Editor } from './Editor.ts';
import { Feature } from './Feature.ts';

export const Config = Object.assign(function initConfig (
  el = elById("sidebar")
) {
  on(el, "change", Editor.update);
  DOM.append(el, DOM(['ul.features', ...Config.Env()]));
  DOM.append(el, DOM(['ul.features', ...Config.Btc()]));
  DOM.append(el, DOM(['ul.features', ...Config.Ecma()]));
  DOM.append(el, DOM(['ul.features', ...Config.Rust()]));
  DOM.append(el, DOM(['ul.features', ...Config.Sol()]));
  DOM.append(el, DOM(['ul.features', ...Config.Tm()]));
  return el;
}, {

  Btc: () => [
    Feature(0, "enable:btc", "Bitcoin",
      ["Develop and test with local bitcoind in ", Link(urls.btcTest, "regtest"), " mode."],
      ["RPC", urls.btcRpc]),
    Feature(0, "enable:btc", "Elements",
      ["Develop and test with local elementsd in ", Link(urls.btcTest, "regtest"), " mode."],
      ["RPC", urls.btcRpc]),
    Feature(0, "enable:simf", "SimplicityHL",
      ["Compile and run ", Link(urls.simfRef, "SimplicityHL"), " programs with Simply."],
      ["Language", urls.simfRef],
      ["Jets", urls.simfJets]),
  ],

  Ecma: () => [
    Feature(0, "enable:js", "ECMAScript",
      "JavaScript/TypeScript SDK."),
    Feature(1, "enable:deno", "Deno",
      "Run on next-gen TS/JS runtime by default.",
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
    Feature.Disabled(1, "enable:vite", "Vite", "Build your front-end in the same repo."),
  ],

  Env: () => [
    Feature(0, "enable:git", "Git",
      "Automatically init Git repo in new project."),
    Feature(0, "enable:nix", "Nix Shell",
      ["Obtain dependencies from ", Link(urls.nixPkgs, "nixpkgs")],
      ["Install", urls.nixInstall]),
    Feature(0, "enable:direnv", "Direnv",
      ["Automatically load Nix shell when entering project directory."],
      ["Wiki", urls.direnvWiki]),
    Feature.Disabled(0, "enable:editorconfig", "EditorConfig",
      "IDE-agnostic settings.",
      ["Spec", urls.edConfSpec]),
    Feature.Disabled(0, "enable:gha",   "GHA",
      "Config for GitHub Actions."),
    Feature.Disabled(0, "enable:drone", "Drone",
      "Config for Drone CI."),
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

});

