{
  arsenal ? (builtins.fetchGit {
    url = "git@github.com:hackbg/arsenal.git";
    rev = "8af955d6e7830dff332e04fcb8480ef8d260a55f";
    ref = "next";
  }),
  pkgs    ? import <nixpkgs> { overlays = [ (import arsenal) ]; },
  ...
}: pkgs.mkShell {
  name = "hackbg-fadroma-dev";
  buildInputs = with pkgs; [
    hackbg.js
    hackbg.neovim
    hackbg.rust
    hackbg.util
    electron_6
  ];
  shellHook = ''
    export PS1='\n\e[0;35mғᴀᴅʀᴏᴍᴀ ⬢ \w\e[0m '
    export ELECTRON_RUNTIME='${pkgs.electron_6.out}/bin/electron'
  '';
}
