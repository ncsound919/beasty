#!/usr/bin/env python3
"""Builds ui/index.html from ui/src.html:
  - inlines JUCE's official webview-interop bridge (so the UI is one self-contained file for BinaryData)
  - adds a tiny mock backend that only activates in a normal browser (no window.__JUCE__), for UI preview/testing
Usage: python3 tools/build_ui.py [path/to/JUCE]
"""
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
juce = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root.parent / "JUCE"
bridge_path = juce / "modules/juce_gui_extra/native/typescript/webview-interop/dist/index.js"
bridge = bridge_path.read_text()
bridge = re.sub(r"//# sourceMappingURL=.*", "", bridge)
bridge, n = re.subn(r"export\s*\{[^}]*\};", "return { getSliderState, getNativeFunction };", bridge)
assert n == 1, "could not rewrite bridge exports"
bridge_block = "const Juce = (() => {\n" + bridge + "\n})();"

mock = r"""<script>
/* Browser-preview mock: only runs when the page is NOT hosted inside JUCE. */
if (typeof window.__JUCE__ === "undefined" || typeof window.__JUCE__.postMessage === "undefined") {
  const P = () => window.__MS_PARAMS__, values = {};
  const props = id => { const p = P()[id]; return p.n ? { start:0, end:p.n-1, skew:1, interval:1 } : { start:p.min??0, end:p.max??1, skew:p.skew??1, interval:p.step??0 }; };
  const toBackend = (eventId, payload) => setTimeout(() => window.__JUCE__.backend.emitByBackend(eventId, JSON.stringify(payload)), 0);
  window.__JUCE__ = {
    initialisationData: { __juce__platform: [], __juce__functions: ["noteOn","noteOff"], __juce__registeredGlobalEventIds: [],
      __juce__sliders: ["OSC1_RANGE","OSC2_RANGE","OSC3_RANGE","OSC1_WAVE","OSC2_WAVE","OSC3_WAVE","OSC2_FREQ","OSC3_FREQ","MIX_OSC1","MIX_OSC2","MIX_OSC3","MIX_NOISE",
        "FILTER_CUTOFF","FILTER_RES","FILTER_DRIVE","FILTER_ENV","FILTER_KEYTRACK","FENV_ATTACK","FENV_DECAY","FENV_SUSTAIN","FENV_RELEASE",
        "AENV_ATTACK","AENV_DECAY","AENV_SUSTAIN","AENV_RELEASE","ANALOG_DRIFT","MASTER_VOLUME"], __juce__toggles: [], __juce__comboBoxes: [] },
    postMessage(str) {
      const { eventId, payload } = JSON.parse(str);
      if (eventId === "__juce__invoke") { window.__MS_CALLS__ = (window.__MS_CALLS__ || []).concat([[payload.name, ...payload.params]]);
        return toBackend("__juce__complete", { promiseId: payload.resultId, result: true }); }
      const m = /^__juce__slider(.+)$/.exec(eventId); if (!m) return; const id = m[1];
      if (payload.eventType === "requestInitialUpdate") {
        // deferred: the bridge asks at import time, before the page has defined its parameter table
        setTimeout(() => {
          toBackend(eventId, { eventType: "propertiesChanged", name: id, label: "", numSteps: 100, parameterIndex: -1, ...props(id) });
          toBackend(eventId, { eventType: "valueChanged", value: values[id] ?? P()[id].def });
        }, 0);
      } else if (payload.eventType === "valueChanged") values[id] = payload.value;
    }
  };
}
</script>"""

src = (root / "ui/src.html").read_text()
assert "/*__BRIDGE__*/" in src and "<!--__MOCK__-->" in src
out = src.replace("/*__BRIDGE__*/", bridge_block).replace("<!--__MOCK__-->", mock)
(root / "ui/index.html").write_text(out)
print(f"ui/index.html: {len(out)/1024:.1f} KB")
