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

# build, lint, and typecheck repo
[group("core")]
build: lint typecheck
	bun i
	bun run build

alias b := build

# lint repo
[group("core")]
lint:
	bun run lint

alias l := lint

# typecheck repo
[group("core")]
typecheck:
	bun run typecheck

alias t := typecheck

# INFO: ----------------------
#         util scripts
# ----------------------------

# regenerate bun.lock + node_modules from scratch
[group("util")]
clean:
	rm -rf node_modules bun.lock bun.lockb
	bun i

alias c := clean
