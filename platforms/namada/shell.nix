{pkgs?(import <nixpkgs> {}),...}:pkgs.mkShell {
  nativeBuildInputs = with pkgs; [
    rustup
  ];
  LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath (with pkgs; [
    stdenv.cc.cc.lib
  ]);
}
