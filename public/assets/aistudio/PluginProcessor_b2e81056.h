#pragma once
#include <juce_audio_processors/juce_audio_processors.h>
#include "Dsp.h"
#include "ParameterIDs.h"

class MiniSynthProcessor : public juce::AudioProcessor
{
public:
    MiniSynthProcessor();
    ~MiniSynthProcessor() override = default;

    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override {}
    bool isBusesLayoutSupported (const BusesLayout&) const override;
    using juce::AudioProcessor::processBlock;     // keep the double-precision overload visible
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return "MiniSynth"; }
    bool acceptsMidi() const override { return true; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 8.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock&) override;
    void setStateInformation (const void*, int) override;

    juce::AudioProcessorValueTreeState apvts;
    juce::MidiKeyboardState keyboardState;     // fed by the on-screen keyboard in the web UI

private:
    static juce::AudioProcessorValueTreeState::ParameterLayout createLayout();
    void syncParams();
    void handleMidi (const juce::MidiMessage&);
    float raw (const char* id) const { return apvts.getRawParameterValue (id)->load(); }

    ms::Engine engine;
    ms::Params params;
    float bendSemis = 0.f;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MiniSynthProcessor)
};
