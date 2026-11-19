#include "PluginProcessor.h"
#include "PluginEditor.h"

using namespace ParameterIDs;

juce::AudioProcessorValueTreeState::ParameterLayout MiniSynthProcessor::createLayout()
{
    using APF = juce::AudioParameterFloat;
    using APC = juce::AudioParameterChoice;
    using Range = juce::NormalisableRange<float>;
    juce::AudioProcessorValueTreeState::ParameterLayout l;

    auto pid = [] (const char* s) { return juce::ParameterID { s, 1 }; };
    const juce::StringArray ranges { "32'", "16'", "8'", "4'", "2'" };
    const juce::StringArray waves  { "Triangle", "Saw", "Square", "Pulse" };

    auto flt = [&] (const char* id, const char* name, Range r, float def, const char* unit = "")
    { l.add (std::make_unique<APF> (pid (id), name, r, def, juce::AudioParameterFloatAttributes().withLabel (unit))); };
    auto unit01 = [&] (const char* id, const char* name, float def) { flt (id, name, Range (0.f, 1.f), def); };
    auto time   = [&] (const char* id, const char* name, float def) { flt (id, name, Range (0.001f, 8.f, 0.f, 0.35f), def, "s"); };

    l.add (std::make_unique<APC> (pid (OSC1_RANGE), "Osc 1 Range", ranges, 2));
    l.add (std::make_unique<APC> (pid (OSC2_RANGE), "Osc 2 Range", ranges, 2));
    l.add (std::make_unique<APC> (pid (OSC3_RANGE), "Osc 3 Range", ranges, 1));
    l.add (std::make_unique<APC> (pid (OSC1_WAVE),  "Osc 1 Wave",  waves, ms::Saw));
    l.add (std::make_unique<APC> (pid (OSC2_WAVE),  "Osc 2 Wave",  waves, ms::Saw));
    l.add (std::make_unique<APC> (pid (OSC3_WAVE),  "Osc 3 Wave",  waves, ms::Square));
    flt (OSC2_FREQ, "Osc 2 Fine", Range (-100.f, 100.f, 0.1f), 6.f, "ct");
    flt (OSC3_FREQ, "Osc 3 Fine", Range (-100.f, 100.f, 0.1f), -5.f, "ct");

    unit01 (MIX_OSC1, "Osc 1 Level", 0.8f);
    unit01 (MIX_OSC2, "Osc 2 Level", 0.6f);
    unit01 (MIX_OSC3, "Osc 3 Level", 0.5f);
    unit01 (MIX_NOISE, "Noise Level", 0.f);

    flt (FILTER_CUTOFF, "Filter Cutoff", Range (20.f, 20000.f, 0.f, 0.3f), 1800.f, "Hz");
    unit01 (FILTER_RES, "Filter Resonance", 0.25f);
    unit01 (FILTER_DRIVE, "Filter Drive", 0.3f);
    unit01 (FILTER_ENV, "Filter Env Amount", 0.5f);
    unit01 (FILTER_KEYTRACK, "Filter Key Track", 0.5f);

    time (FENV_ATTACK, "Filter Attack", 0.005f);  time (FENV_DECAY, "Filter Decay", 0.4f);
    unit01 (FENV_SUSTAIN, "Filter Sustain", 0.3f); time (FENV_RELEASE, "Filter Release", 0.3f);
    time (AENV_ATTACK, "Amp Attack", 0.005f);     time (AENV_DECAY, "Amp Decay", 0.3f);
    unit01 (AENV_SUSTAIN, "Amp Sustain", 0.8f);   time (AENV_RELEASE, "Amp Release", 0.25f);

    unit01 (ANALOG_DRIFT, "Analog Drift", 0.3f);
    unit01 (MASTER_VOLUME, "Master Volume", 0.7f);
    return l;
}

MiniSynthProcessor::MiniSynthProcessor()
    : AudioProcessor (BusesProperties().withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      apvts (*this, nullptr, "STATE", createLayout())
{
}

void MiniSynthProcessor::prepareToPlay (double sampleRate, int)
{
    syncParams();
    engine.prepare (sampleRate);
    engine.setParams (params);
    keyboardState.reset();
}

bool MiniSynthProcessor::isBusesLayoutSupported (const BusesLayout& l) const
{
    return l.getMainOutputChannelSet() == juce::AudioChannelSet::stereo();
}

void MiniSynthProcessor::syncParams()
{
    auto& p = params;
    const char* rangeIds[] = { OSC1_RANGE, OSC2_RANGE, OSC3_RANGE };
    const char* waveIds[]  = { OSC1_WAVE,  OSC2_WAVE,  OSC3_WAVE };
    const char* levelIds[] = { MIX_OSC1,   MIX_OSC2,   MIX_OSC3 };
    for (int i = 0; i < 3; ++i)
    {
        p.octave[i] = (int) std::lround (raw (rangeIds[i])) - 2;        // index 2 = 8' = no shift
        p.wave[i]   = juce::jlimit (0, 3, (int) std::lround (raw (waveIds[i])));
        p.level[i]  = raw (levelIds[i]);
    }
    p.fineCents[0] = 0.f; p.fineCents[1] = raw (OSC2_FREQ); p.fineCents[2] = raw (OSC3_FREQ);
    p.noise = raw (MIX_NOISE);
    p.cutoffHz = raw (FILTER_CUTOFF); p.resonance = raw (FILTER_RES); p.drive = raw (FILTER_DRIVE);
    p.envAmount = raw (FILTER_ENV);   p.keyTrack = raw (FILTER_KEYTRACK);
    p.fA = raw (FENV_ATTACK); p.fD = raw (FENV_DECAY); p.fS = raw (FENV_SUSTAIN); p.fR = raw (FENV_RELEASE);
    p.aA = raw (AENV_ATTACK); p.aD = raw (AENV_DECAY); p.aS = raw (AENV_SUSTAIN); p.aR = raw (AENV_RELEASE);
    p.drift = raw (ANALOG_DRIFT); p.master = raw (MASTER_VOLUME) * 1.5f;
    p.bendSemis = bendSemis;
}

void MiniSynthProcessor::handleMidi (const juce::MidiMessage& m)
{
    if (m.isNoteOn())                          engine.noteOn (m.getNoteNumber(), m.getFloatVelocity());
    else if (m.isNoteOff())                    engine.noteOff (m.getNoteNumber());
    else if (m.isAllNotesOff() || m.isAllSoundOff()) engine.allNotesOff();
    else if (m.isPitchWheel())
    {
        bendSemis = (float) (m.getPitchWheelValue() - 8192) / 8192.f * 2.f;
        params.bendSemis = bendSemis;
        engine.setParams (params);
    }
    else if (m.isControllerOfType (64))        engine.setSustain (m.getControllerValue() >= 64);
}

void MiniSynthProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midi)
{
    juce::ScopedNoDenormals noDenormals;
    const int n = buffer.getNumSamples();
    buffer.clear();
    if (buffer.getNumChannels() < 2) return;

    keyboardState.processNextMidiBuffer (midi, 0, n, true);
    syncParams();
    engine.setParams (params);

    float* L = buffer.getWritePointer (0);
    float* R = buffer.getWritePointer (1);
    int pos = 0;
    for (const auto meta : midi)
    {
        const int t = juce::jlimit (pos, n, meta.samplePosition);
        if (t > pos) { engine.render (L + pos, R + pos, t - pos); pos = t; }
        handleMidi (meta.getMessage());
    }
    if (pos < n) engine.render (L + pos, R + pos, n - pos);
    midi.clear();
}

juce::AudioProcessorEditor* MiniSynthProcessor::createEditor() { return new MiniSynthEditor (*this); }

void MiniSynthProcessor::getStateInformation (juce::MemoryBlock& dest)
{
    if (auto xml = apvts.copyState().createXml()) copyXmlToBinary (*xml, dest);
}

void MiniSynthProcessor::setStateInformation (const void* data, int size)
{
    if (auto xml = getXmlFromBinary (data, size))
        if (xml->hasTagName (apvts.state.getType()))
            apvts.replaceState (juce::ValueTree::fromXml (*xml));
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() { return new MiniSynthProcessor(); }
