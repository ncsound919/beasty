#pragma once
#include <juce_gui_extra/juce_gui_extra.h>
#include "PluginProcessor.h"

class MiniSynthEditor : public juce::AudioProcessorEditor
{
public:
    explicit MiniSynthEditor (MiniSynthProcessor&);
    void resized() override;

private:
    std::optional<juce::WebBrowserComponent::Resource> getResource (const juce::String& url) const;

    MiniSynthProcessor& proc;

    // Declaration order matters: relays -> attachments -> web view (destroyed in reverse).
    std::vector<std::unique_ptr<juce::WebSliderRelay>> relays;
    std::vector<std::unique_ptr<juce::WebSliderParameterAttachment>> attachments;
    std::unique_ptr<juce::WebBrowserComponent> web;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MiniSynthEditor)
};
