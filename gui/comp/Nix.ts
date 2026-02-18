import { Fields } from './Field.ts';
export default ({ nix, btc, simf, element }) => nix && Fields.Text("shell.nix",
  `#!/usr/bin/env nix-shell`,
  `{ pkgs ? import<nixpkgs> {} }: let`,
  //`  # Build Rust package.`,
  //`  rs = p: (pkgs.rustPlatform.buildRustPackage p);`,
  `  gh = owner: repo: rev: sha256: pkgs.fetchFromGitHub { inherit owner repo rev sha256; };`,
  //`  # Build Rust package from GitHub.`,
  //`  rs-gh = owner: pname: version: sha256: cargoHash: (rs rec {`,
  //`    inherit pname version cargoHash;`,
  //`    src = gh owner pname version sha256;`,
  //`    nativeBuildInputs = [pkgs.pkg-config];`,
  //`    PKG_CONFIG_PATH = "\${pkgs.openssl.dev}/lib/pkgconfig";`,
  //`  });`,
  `  override = pkg: attrs: pkg.overrideAttrs (_: attrs);`,
  `in pkgs.mkShell { nativeBuildInputs = [`,
  `  just  # Shell command runner`,
  `  deno  # TypeScript runtime`,

  //...(btc
    //? [ ``, `  pkgs.bitcoind` ]
    //: []),

  //...(simf
    //? [ ``
      //, `  pkgs.mcpp`
      //, ``
      //, `  (rs-gh "starkware-bitcoin" "simply" "3e1d0589"`
      //, `    "sha256-EKfeEsr/sG/SorT2GK/ovMvI2QaoTMZ1wehbCcSjEmQ="`
      //, `    "sha256-N2i5IJtKU1iPkpBaX90LgA7gw8B3n+K5hbByJOMRV3o=")`
      //]
    //: []),

  ...(element
    ? [ ``
      , `  (override pkgs.elementsd {`
      , `    version = "liquid-testnet-2024-10-08";`
      , `    src = gh "ElementsProject" "elements"`
      , `      "f957d3cde17c85afb18c6747f9c0b4fcb599f19a"`
      , `      "sha256-XzdfbrQ7s4PfM5N00oP1jo5BNmD4WUMUe79QsTxsL4s=";`
      , `    withWallet = true;`
      , `    withGui = false;`
      , `    doCheck = false;`
      , `  })` ]
    : []),

  `\n]; }`);
