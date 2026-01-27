{
  description = "Development environment for an Obsidian plugin using Bun";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/release-25.11";
    flake-utils.url = "github:numtide/flake-utils";
    treefmt-nix.url = "github:numtide/treefmt-nix";
    systems.url = "github:nix-systems/default";
  };

  outputs =
    {
      self,
      nixpkgs,
      systems,
      flake-utils,
      treefmt-nix,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShell = pkgs.mkShell {
          buildInputs = with pkgs; [
            bun
            just
          ];
        };

        packages.default = pkgs.buildEnv {
          name = "empty default profile";
          paths = [ ];
        };

        # used by auto release
        packages.semanticRelease = pkgs.buildEnv {
          name = "gh action raw bun profile";
          paths = with pkgs; [
            bun
            nodejs_24
          ];
        };
      }
    )
    // (
      let
        eachSystem = f: nixpkgs.lib.genAttrs (import systems) (system: f nixpkgs.legacyPackages.${system});
        treefmtEval = eachSystem (pkgs: treefmt-nix.lib.evalModule pkgs ./treefmt.nix);
      in
      {
        # for `nix fmt`
        formatter = eachSystem (pkgs: treefmtEval.${pkgs.stdenv.hostPlatform.system}.config.build.wrapper);
        # for `nix flake check`
        checks = eachSystem (pkgs: {
          formatting = treefmtEval.${pkgs.stdenv.hostPlatform.system}.config.build.check self;
        });
      }
    );
}
