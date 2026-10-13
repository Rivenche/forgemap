#!/usr/bin/env python3
"""ForgeMap: give every local script and stylesheet the pages load a ?v=<manifest version>, so a
browser or a CDN that kept the old file for hours (Cloudflare's browser TTL, for one) takes the
new one the moment a new version is installed. The mod ignores the query when it serves a file.
Run by package.sh; safe to run again (an old ?v= is replaced)."""
import json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
WEB = ROOT / "WebMap" / "web"
v = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))["version_number"]
# plus the build's own mark, so two builds of one version never share a cached file
import subprocess, time
try: v += "-" + subprocess.run(["git", "-C", str(ROOT), "rev-parse", "--short", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
except Exception: v += "-" + time.strftime("%Y%m%d%H%M")
pat = re.compile(r'((?:src|href)=")((?!https?:|//|#|data:)[^"?#]+\.(?:js|css))(?:\?v=[^"]*)?(")')
n = 0
for page in sorted(WEB.glob("*.html")):
    s = page.read_text(encoding="utf-8")
    s2, k = pat.subn(lambda m: f"{m.group(1)}{m.group(2)}?v={v}{m.group(3)}", s)
    if s2 != s:
        page.write_text(s2, encoding="utf-8", newline="\n")
    n += k
print(f"?v={v} on {n} references")
