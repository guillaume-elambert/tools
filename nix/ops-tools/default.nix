let
  lock = builtins.fromJSON (builtins.readFile ./flake.lock);
  flakeCompat = lock.nodes.flakeCompat.locked;
  flakeCompatSrc = builtins.fetchTarball {
    url = flakeCompat.url or "https://github.com/edolstra/flake-compat/archive/${flakeCompat.rev}.tar.gz";
    sha256 = flakeCompat.narHash;
  };
  flake = import flakeCompatSrc {src = ./.;};
in
  {system ? builtins.currentSystem, ...}: let
    _ = builtins.trace "Using ${system} system" flake.defaultNix.defaultPackage.${system};
  in
    if builtins.hasAttr system flake.defaultNix.defaultPackage
    then flake.defaultNix.defaultPackage.${system}
    else
      builtins.throw ''

        Ops tools does not support the system: ${system}

        Please consider creating an issue requesting
        support for such system:
        https://github.com/guillaume-elambert/tools

        Thank you!

      ''
