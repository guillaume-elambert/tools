# Nix profiles

The folder current folder refers the [`Nix`][nix] configuration to install tools. 

These aims to replace the [linux setup folder][linux_setup].


## OPS tools

This Nix profile installs some usefull tools for OPS:
- `git`
- `go`
- `jq`
- `yq`
- `kubectl`
- `kubectx`
- `kustomize`
- `k9s`
- `kubernetes-helm`
- `helmfile`
- `ansible`
- `terraform`

To install these tools, run one of the following commands:
```sh
# Install from this repository
~ nix profile install github:guillaume-elambert/tools?dir=nix/ops-tools#ops-tools
# Install from local sources
~ nix profile install ./nix/ops-tools#ops-tools
```


[nix]: https://nix.dev/
[linux_setup]: /linux/bash/setup/