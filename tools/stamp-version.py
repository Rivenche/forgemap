#!/usr/bin/env python3
"""ForgeMap: give every local script and stylesheet the pages load a ?v=<manifest version>-<commit>,
so a browser or a CDN that kept the old file for hours (Cloudflare's browser TTL, for one) takes
the new one the moment a new build is installed. The mod ignores the query when it serves a file.

    stamp-version.py <web dir>          stamp a COPY of the viewer (package.sh: dist/pkg/web)
    stamp-version.py --strip <web dir>  take the stamps off again

The tracked WebMap/web stays unstamped; an old ?v= is replaced, so running it twice is safe."""
import json, pathlib, re, subprocess, sys, time

ROOT = pathlib.Path(__file__).resolve().parent.parent
args = sys.argv[1:]
strip = "--strip" in args
args = [a for a in args if a != "--strip"]
if len(args) != 1:
    sys.exit(__doc__)
web = pathlib.Path(args[0]).resolve()
if web == (ROOT / "WebMap" / "web").resolve() and not strip:
    sys.exit("stamp a copy, not the tracked WebMap/web")

v = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))["version_number"]
# plus the build's own mark, so two builds of one version never share a cached file
try:
    v += "-" + subprocess.run(["git", "-C", str(ROOT), "rev-parse", "--short", "HEAD"],
                              capture_output=True, text=True, check=True).stdout.strip()
except Exception:
    v += "-" + time.strftime("%Y%m%d%H%M")
pat = re.compile(r'((?:src|href)=")((?!https?:|//|#|data:)[^"?#]+\.(?:js|css))(?:\?v=[^"]*)?(")')
n = 0
for page in sorted(web.glob("*.html")):
    s = page.read_text(encoding="utf-8")
    s2, k = pat.subn((lambda m: m.group(1) + m.group(2) + m.group(3)) if strip
                     else (lambda m: f"{m.group(1)}{m.group(2)}?v={v}{m.group(3)}"), s)
    if s2 != s:
        page.write_text(s2, encoding="utf-8", newline="\n")
    n += k
print(("stamps removed from" if strip else f"?v={v} on"), n, "references in", web)
