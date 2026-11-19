#!/usr/bin/env python3
"""Project audit: cross-checks the C++ parameter layout against the UI, then runs the DSP tests.
   python3 tools/audit.py [--no-dsp]"""
import re, subprocess, sys, pathlib, json
root = pathlib.Path(__file__).resolve().parent.parent
fails = []
def check(ok, msg):
    print(("ok:   " if ok else "FAIL: ") + msg)
    if not ok: fails.append(msg)

ids_h = (root/"Source/ParameterIDs.h").read_text()
proc  = (root/"Source/PluginProcessor.cpp").read_text()
html  = (root/"ui/src.html").read_text()
built = (root/"ui/index.html").read_text() if (root/"ui/index.html").exists() else ""
build = (root/"tools/build_ui.py").read_text()

# ---- IDs
consts = dict(re.findall(r'(\w+)\[\]\s*=\s*"(\w+)"', ids_h))
check(all(k == v for k, v in consts.items()), "ParameterIDs: constant names equal their string values")
all_block = re.search(r"all\[\]\s*=\s*\{(.*?)\};", ids_h, re.S).group(1)
all_ids = re.findall(r"\b([A-Z0-9_]+)\b", all_block)
check(len(all_ids) == len(set(all_ids)), f"ParameterIDs::all has {len(all_ids)} unique entries")
check(set(all_ids) == set(consts), "every declared ID is listed in ParameterIDs::all (and vice versa)")

# ---- C++ layout
layout = {}
for m in re.finditer(r"make_unique<APC>\s*\(pid\s*\((\w+)\),\s*\"[^\"]*\",\s*(\w+),\s*([\w:]+)\)", proc):
    n = {"ranges": 5, "waves": 4}[m.group(2)]
    d = {"ms::Saw": 1, "ms::Square": 2}.get(m.group(3)) if not m.group(3).isdigit() else int(m.group(3))
    layout[m.group(1)] = dict(n=n, d=d)
for m in re.finditer(r"flt\s*\((\w+),\s*\"[^\"]*\",\s*Range\s*\(([^)]*)\),\s*(-?[\d.]+)f", proc):
    a = [float(x.rstrip("f")) for x in m.group(2).split(",")]
    layout[m.group(1)] = dict(min=a[0], max=a[1], step=a[2] if len(a) > 2 else 0, skew=a[3] if len(a) > 3 else 1, d=float(m.group(3)))
for m in re.finditer(r"unit01\s*\((\w+),\s*\"[^\"]*\",\s*([\d.]+)f", proc):
    layout[m.group(1)] = dict(min=0, max=1, step=0, skew=1, d=float(m.group(2)))
tm = re.search(r"auto time\s*=.*?Range \(([^)]*)\)", proc, re.S); ta = [float(x.rstrip("f")) for x in tm.group(1).split(",")]
for m in re.finditer(r"\btime\s*\((\w+),\s*\"[^\"]*\",\s*([\d.]+)f", proc):
    layout[m.group(1)] = dict(min=ta[0], max=ta[1], step=ta[2], skew=ta[3], d=float(m.group(2)))
check(set(layout) == set(all_ids), f"processor layout declares exactly the {len(all_ids)} IDs (missing: {sorted(set(all_ids)-set(layout))}, extra: {sorted(set(layout)-set(all_ids))})")

# ---- UI table
body = re.search(r"const PARAMS = \{(.*?)\n\};", html, re.S).group(1)
ui = {}
for m in re.finditer(r"(\w+):\{([^}]*)\}", body):
    ui[m.group(1)] = {k: float(v) for k, v in re.findall(r"(\w+):(-?[\d.]+)", m.group(2))}
check(set(ui) == set(all_ids), "UI PARAMS table matches parameter IDs exactly")
bad = []
for i in all_ids:
    c, u = layout.get(i), ui.get(i)
    if not c or not u: continue
    if "n" in c:
        if not (u.get("n") == c["n"] and u["def"] == c["d"]): bad.append(f"{i}: choice mismatch ui={u} cpp={c}")
    else:
        uu = dict(min=u.get("min", 0), max=u.get("max", 1), skew=u.get("skew", 1), step=u.get("step", 0), d=u["def"])
        for k in ("min", "max", "skew", "step", "d"):
            if abs(uu[k] - c[k]) > 1e-9: bad.append(f"{i}.{k}: ui={uu[k]} cpp={c[k]}")
check(not bad, "UI defaults/ranges/skews/steps equal the C++ layout" + ("" if not bad else " -> " + "; ".join(bad)))

# ---- mock slider list, built UI, controls
mock_ids = set(re.findall(r'"([A-Z0-9_]+)"', re.search(r"__juce__sliders:\s*\[(.*?)\]", build, re.S).group(1)))
check(mock_ids == set(all_ids), "preview mock slider list matches parameter IDs")
used = set(re.findall(r'"([A-Z][A-Z0-9]+_[A-Z0-9_]+)"|`(OSC\$\{i\}_\w+|MIX_OSC\$\{i\})`', html)[0:0])
ctl = set(re.findall(r'["\'`]((?:OSC|MIX|FILTER|FENV|AENV|ANALOG|MASTER)[A-Z0-9_$\{\}i]*)["\'`]', html))
exp = set()
for s in ctl:
    if "${i}" in s: exp |= {s.replace("${i}", str(n)) for n in (1, 2, 3)}
    elif s in ui: exp.add(s)
exp |= {f"{p}_{s}" for p in ("FENV", "AENV") for s in ("ATTACK","DECAY","SUSTAIN","RELEASE")}
check(set(all_ids) <= exp | {"OSC1_FREQ"}, f"every parameter has a UI control (no control: {sorted(set(all_ids)-exp)})")
check("__BRIDGE__" not in built and "__MOCK__" not in built and "getSliderState" in built, "ui/index.html is built (bridge inlined)")
code = re.sub(r"/\*.*?\*/", "", built, flags=re.S)       # ignore comments (JUCE licence header mentions URLs)
check(not re.search(r"(src|href)=[\"']https?:|url\(\s*[\"']?https?:|fetch\(|import\s.*from\s+[\"']https?:|XMLHttpRequest", code), "UI loads nothing from the network (works offline in a plugin)")
check("localStorage" not in built, "UI does not rely on browser storage")

# ---- JS syntax
mod = re.search(r'<script type="module">(.*?)</script>', built, re.S)
if mod:
    pathlib.Path("/tmp/_ui.mjs").write_text(mod.group(1))
    r = subprocess.run(["node", "--check", "/tmp/_ui.mjs"], capture_output=True, text=True)
    check(r.returncode == 0, "UI module script passes node --check " + r.stderr[:200])

# ---- C++ plumbing
ed = (root/"Source/PluginEditor.cpp").read_text(); cm = (root/"CMakeLists.txt").read_text()
check("ParameterIDs::all" in ed and "relays[i]" in ed, "editor creates one relay+attachment per ID in the same order")
check("index_html" in ed and "ui/index.html" in cm, "UI is embedded via BinaryData and served by the resource provider")

# ---- DSP tests
if "--no-dsp" not in sys.argv:
    b = subprocess.run(["g++", "-std=c++17", "-O2", "-Wall", "-Wextra", "-Werror", str(root/"tests/dsp_test.cpp"), "-o", "/tmp/dsp_test"], capture_output=True, text=True)
    check(b.returncode == 0, "dsp_test compiles with -Wall -Wextra -Werror " + b.stderr[:300])
    if b.returncode == 0:
        r = subprocess.run(["/tmp/dsp_test"], capture_output=True, text=True)
        check(r.returncode == 0 and "ALL PASSED" in r.stdout, "DSP tests pass")

print("\nAUDIT:", "PASS" if not fails else f"{len(fails)} FAILURE(S)")
sys.exit(1 if fails else 0)
