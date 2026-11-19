# MiniSynth

Minimoog-flavoured 8-voice synth. **JUCE 8 C++ DSP + WebView UI**, VST3 / AU / Standalone.

```
Source/Dsp.h              all DSP (std-only, no JUCE): PolyBLEP osc x3, ladder filter, ADSR x2, drift, voice engine
Source/ParameterIDs.h     the ID contract shared with the UI (ALL_CAPS snake_case)
Source/PluginProcessor.*  APVTS layout, MIDI handling, block rendering
Source/PluginEditor.*     WebBrowserComponent + one WebSliderRelay/Attachment per parameter
ui/src.html               the panel (vanilla JS, no build toolchain)
ui/index.html             generated: src.html + JUCE's official JS bridge + browser-preview mock
tools/build_ui.py         regenerates ui/index.html
tools/audit.py            cross-checks C++ <-> UI and runs the DSP tests
tests/dsp_test.cpp        offline DSP tests (aliasing, stability, voice stealing, sustain ...)
demo/engine_chord.wav     rendered straight from Dsp.h so you can hear the engine before building
```

## Build

```bash
git clone https://github.com/juce-framework/JUCE.git ../JUCE     # or pass -DJUCE_DIR=...
python3 tools/build_ui.py ../JUCE                                  # only needed after editing ui/src.html
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --target MiniSynth_Standalone   # or MiniSynth_VST3 / MiniSynth_AU
```
* Windows: install the WebView2 NuGet package (`nuget install Microsoft.Web.WebView2`) and point CMake at it; see JUCE's `WebViewPluginDemo`.
* Linux: `libwebkit2gtk-4.1-dev libgtk-3-dev libasound2-dev libfreetype-dev libx11-dev libcurl4-openssl-dev`.
* UI preview without building the plugin: open `ui/index.html` in a browser (a mock backend kicks in; no sound).

## Panel
Three oscillators (32'-2' range, triangle/saw/square/pulse, fine tune on 2 and 3), noise, ladder filter with live
response display, filter + amp ADSR with live curves, drift and master. Drag knobs vertically, shift = fine,
double-click = reset, wheel and arrow keys work. On-screen keys (C3-B5) and computer keys (`a w s e d f t g y h u j k o l p ;`, `z`/`x` = octave).

## Differences from the earlier plan
* UI is plain JS served from one embedded HTML file (no React build step). Swapping in React later only touches `ui/`; the parameter contract is unchanged.
* Arpeggiator left out to keep it simple. Envelope IDs are explicit (`FENV_*`, `AENV_*`), plus `FILTER_DRIVE/ENV/KEYTRACK`, `MIX_OSC2/3`, `OSC1_WAVE..3`, `MASTER_VOLUME`.
* Triangle is an integrated band-limited square; ladder filter is 2x internally oversampled (not `juce::dsp::Oversampling`).

## Audit
`python3 tools/audit.py` - all checks must pass before shipping a change.
