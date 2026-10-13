#!/usr/bin/env bash
# Build the Thunderstore upload zip (dist/ForgeMap-<version>.zip) from manifest.json.
set -euo pipefail
cd "$(dirname "$0")"
V=$(python3 -c "import json;print(json.load(open('manifest.json'))['version_number'])")
dotnet build WebMap/WebMap.csproj -c Release -v minimal

# The bundled viewer is WebMap/web: tracked source, and its site-config.js is the
# same-origin one, so the package is the repo as it stands.
[ -s WebMap/web/index.html ] && [ -s WebMap/web/map-core.js ] || { echo "WebMap/web is missing" >&2; exit 1; }

rm -rf dist/pkg "dist/ForgeMap-$V.zip"
mkdir -p dist/pkg
cp manifest.json README.md README-WebMap.md CHANGELOG.md icon.png LICENSE dist/pkg/
cp WebMap/bin/Release/WebMap.dll WebMap/bin/Release/websocket-sharp.dll dist/pkg/
cp -r WebMap/web dist/pkg/web
python3 tools/stamp-version.py dist/pkg/web   # ?v= on the copy: caches take the new build at once
(cd dist/pkg && zip -qr "../ForgeMap-$V.zip" . -x '.*')
echo "dist/ForgeMap-$V.zip"
