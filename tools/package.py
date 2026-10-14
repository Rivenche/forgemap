#!/usr/bin/env python3
"""ForgeMap: build the Thunderstore upload zip, dist/ForgeMap-<version>.zip -- package.sh's steps in
Python, for a Windows box without bash/zip. The viewer comes from the commit (git archive HEAD), so
untracked or half-edited files never ship; its scripts get the ?v= stamp on the copy.

    py -3 tools/package.py            (dotnet: $DOTNET, else ~/.dotnet/dotnet.exe, else dotnet)
"""
import io, json, os, pathlib, shutil, subprocess, sys, tarfile, zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
os.chdir(ROOT)
v = json.loads(pathlib.Path("manifest.json").read_text(encoding="utf-8"))["version_number"]
dotnet = os.environ.get("DOTNET") or next((str(p) for p in [pathlib.Path.home() / ".dotnet" / "dotnet.exe"] if p.exists()), "dotnet")
subprocess.run([dotnet, "build", "WebMap/WebMap.csproj", "-c", "Release", "-v", "minimal"], check=True)

pkg = ROOT / "dist" / "pkg"
shutil.rmtree(pkg, ignore_errors=True)
pkg.mkdir(parents=True)
for f in ["manifest.json", "README.md", "README-WebMap.md", "CHANGELOG.md", "icon.png", "LICENSE"]:
    shutil.copy2(f, pkg / f)
for f in ["ForgeMap.dll", "websocket-sharp.dll"]:
    shutil.copy2(ROOT / "WebMap" / "bin" / "Release" / f, pkg / f)
tar = subprocess.run(["git", "archive", "--format=tar", "HEAD", "WebMap/web"], check=True, capture_output=True).stdout
with tarfile.open(fileobj=io.BytesIO(tar)) as t:
    t.extractall(pkg / "_src", filter="data")
shutil.move(str(pkg / "_src" / "WebMap" / "web"), str(pkg / "web"))
shutil.rmtree(pkg / "_src")
subprocess.run([sys.executable, "tools/stamp-version.py", str(pkg / "web")], check=True)

out = ROOT / "dist" / f"ForgeMap-{v}.zip"
out.unlink(missing_ok=True)
bad = ("assembly_", "BepInEx", "0Harmony", "UnityEngine")
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for p in sorted(pkg.rglob("*")):
        if p.is_file() and not p.name.startswith("."):
            rel = p.relative_to(pkg).as_posix()
            if p.name.startswith(bad):
                sys.exit(f"refusing to ship {rel}")
            z.write(p, rel)
print(out, out.stat().st_size // 1024, "KB")
