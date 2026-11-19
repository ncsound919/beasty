// ParameterIDs.h - single source of truth for parameter IDs shared with the web UI.
// IDs are ALL_CAPS snake_case; the UI refers to them by the same strings (tools/audit.py checks this).
#pragma once

namespace ParameterIDs
{
    // Oscillator bank
    inline constexpr char OSC1_RANGE[] = "OSC1_RANGE", OSC2_RANGE[] = "OSC2_RANGE", OSC3_RANGE[] = "OSC3_RANGE";
    inline constexpr char OSC1_WAVE[]  = "OSC1_WAVE",  OSC2_WAVE[]  = "OSC2_WAVE",  OSC3_WAVE[]  = "OSC3_WAVE";
    inline constexpr char OSC2_FREQ[]  = "OSC2_FREQ",  OSC3_FREQ[]  = "OSC3_FREQ";        // fine tune, cents

    // Mixer
    inline constexpr char MIX_OSC1[] = "MIX_OSC1", MIX_OSC2[] = "MIX_OSC2", MIX_OSC3[] = "MIX_OSC3", MIX_NOISE[] = "MIX_NOISE";

    // Filter
    inline constexpr char FILTER_CUTOFF[] = "FILTER_CUTOFF", FILTER_RES[] = "FILTER_RES", FILTER_DRIVE[] = "FILTER_DRIVE",
                          FILTER_ENV[] = "FILTER_ENV", FILTER_KEYTRACK[] = "FILTER_KEYTRACK";

    // Envelopes
    inline constexpr char FENV_ATTACK[] = "FENV_ATTACK", FENV_DECAY[] = "FENV_DECAY", FENV_SUSTAIN[] = "FENV_SUSTAIN", FENV_RELEASE[] = "FENV_RELEASE";
    inline constexpr char AENV_ATTACK[] = "AENV_ATTACK", AENV_DECAY[] = "AENV_DECAY", AENV_SUSTAIN[] = "AENV_SUSTAIN", AENV_RELEASE[] = "AENV_RELEASE";

    // Output
    inline constexpr char ANALOG_DRIFT[] = "ANALOG_DRIFT", MASTER_VOLUME[] = "MASTER_VOLUME";

    inline constexpr const char* all[] = {
        OSC1_RANGE, OSC2_RANGE, OSC3_RANGE, OSC1_WAVE, OSC2_WAVE, OSC3_WAVE, OSC2_FREQ, OSC3_FREQ,
        MIX_OSC1, MIX_OSC2, MIX_OSC3, MIX_NOISE,
        FILTER_CUTOFF, FILTER_RES, FILTER_DRIVE, FILTER_ENV, FILTER_KEYTRACK,
        FENV_ATTACK, FENV_DECAY, FENV_SUSTAIN, FENV_RELEASE, AENV_ATTACK, AENV_DECAY, AENV_SUSTAIN, AENV_RELEASE,
        ANALOG_DRIFT, MASTER_VOLUME };
}
