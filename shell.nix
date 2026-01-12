#!/usr/bin/env nix-shell
{pkgs?import<nixpkgs>{}}: let
  # Define Nix shell.
  sh = name: nativeBuildInputs: opts:
    pkgs.mkShell ({ inherit name nativeBuildInputs; } // opts);
  # Fetch source from GitHub.
  gh = owner: repo: rev: sha256:
    pkgs.fetchFromGitHub { inherit owner repo rev sha256; };
  # Build package.
  pkg = p: (pkgs.callPackage p {});
  # Build Rust package.
  rs = p: (pkgs.rustPlatform.buildRustPackage p);
  # Build Rust package from GitHub.
  rs-gh = owner: pname: version: sha256: cargoHash: (rs rec {
    inherit pname version cargoHash;
    src = gh owner pname version sha256;
    nativeBuildInputs = [pkgs.pkg-config];
    PKG_CONFIG_PATH = "${pkgs.openssl.dev}/lib/pkgconfig";
    doCheck = false;
  });
  # Override package attributes
  over = pkg: attrs: pkg.overrideAttrs (_: attrs);

  deps = [
    pkgs.lld
    pkgs.cloc
    pkgs.deno
    pkgs.bitcoind
    pkgs.binaryen
    pkgs.python3
    (over pkgs.elements {
      patches = [];
      doCheck = false;
      withWallet = true;
      withGui = false;
      version = "23.3.1";
      src = gh "ElementsProject" "elements" "elements-23.3.1"
        "sha256-hqHKH9B6EITwZ4F+YdPJI4n3Z3EeXdPYbzRoNODlThY=";
    })

    # FIXME: provides correct clang without container?
    # pkgs.rustPlatform.bindgenHook

    # Not used.
    # pkgs.emscripten

    # Examples of loading third-party dependencies from GitHub:
    # (rs-gh "starkware-bitcoin" "simply" "3e1d0589"
    #   "sha256-EKfeEsr/sG/SorT2GK/ovMvI2QaoTMZ1wehbCcSjEmQ="
    #   "sha256-N2i5IJtKU1iPkpBaX90LgA7gw8B3n+K5hbByJOMRV3o=")
    # (rs-gh "drager" "wasm-pack" "f28cf3e7"
    #   "sha256-Zv4WFv/lVySs6qfBC/hnZLe6T5Ako/HEDzvP/be4dgM="
    #   "sha256-Dw/Kz4YO/RMRTlUsW+5im3cVmqC80dMVjLc0+Ge536o=")
  ];

  vars = {
    #CC     = "${pkgs.llvmPackages.clang-unwrapped}/bin/clang";
    #CC_wasm32_unknown_unknown     = "${pkgs.llvmPackages.clang-unwrapped}/bin/clang";
    #CFLAGS_wasm32_unknown_unknown = "-I ${pkgs.llvmPackages.libclang.lib}/lib/clang/include/";
  };

in sh "fadroma" deps vars
