shell.nix                                                                                           0000644 0001751 0000177 00000000726 14560206206 012260  0                                                                                                    ustar   runner                          docker                                                                                                                                                                                                                 {
  arsenal ? (builtins.fetchGit {
    url = "git@github.com:hackbg/arsenal.git";
    rev = "c39884ea36e7ee4b6efdf3b509057e59f1911af2";
    ref = "main";
  }),
  pkgs ? import <nixpkgs> { overlays = [ (import arsenal) ]; },
  ...
}: pkgs.mkShell {
  name = "hackbg-fadroma-dev";
  buildInputs = with pkgs; [
    hackbg.js
    hackbg.neovim
    hackbg.rust
    hackbg.util
    act
  ];
  shellHook = ''
    export PS1='\n\e[0;35mғᴀᴅʀᴏᴍᴀ ⬢ \w\e[0m '
  '';
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          