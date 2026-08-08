# default recipe
[private]
default:
    @just --list --unsorted

# INFO: ----------------------
#         main scripts
# ----------------------------

# install dependencies
[group("core")]
install:
	bun i

alias i := install

# build and lint repo
[group("core")]
build: lint
	bun i
	bun run build

alias b := build

# lint repo
[group("core")]
lint:
	bun run lint

alias l := lint

# INFO: ----------------------
#         util scripts
# ----------------------------

# regenerate bun.lockb + node_modules from scratch
[group("util")]
clean:
	rm -rf node_modules bun.lockb
	bun i

alias c := clean
