#!/usr/bin/env bash
# ForgeMap: put the viewer (pages only, no DLL, no restart) on a ForgeServer Valheim server for testing.
#   tools/deploy-test.sh <server uuid>      (from Git Bash on Jason's PC; ssh alias "pterodactyl" = VM 104)
# The mod rereads its web files on each request. The upstream copy was saved once in
# /root/forgemap-sauv/web-webmap-2.16.1 on the VM; to put it back: rsync it over the same folder.
set -euo pipefail
cd "$(dirname "$0")/.."
U=${1:?server uuid}
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
cp -r WebMap/web "$T/web"
py -3 tools/stamp-version.py "$T/web" 2>/dev/null || python3 tools/stamp-version.py "$T/web"
V=/var/lib/pterodactyl/volumes/$U/BepInEx/plugins/WebMap
tar -C "$T" -cz web | ssh pterodactyl "set -e; rm -rf /tmp/fm && mkdir /tmp/fm && tar -C /tmp/fm -xz; sudo rsync -a --delete --chown=pterodactyl:pterodactyl /tmp/fm/web/ $V/web/; echo deployed to $U"
