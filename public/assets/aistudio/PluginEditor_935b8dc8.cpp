#include "PluginEditor.h"
#include "BinaryData.h"

namespace
{
    constexpr int kDefaultW = 1000, kDefaultH = 620;    // UI is laid out on a 1000x620 canvas and scaled by CSS
}

MiniSynthEditor::MiniSynthEditor (MiniSynthProcessor& p) : AudioProcessorEditor (&p), proc (p)
{
    using WB = juce::WebBrowserComponent;

    for (const char* id : ParameterIDs::all)
        relays.push_back (std::make_unique<juce::WebSliderRelay> (id));

    auto options = WB::Options{}
                       .withNativeIntegrationEnabled()
                       .withResourceProvider ([this] (const auto& url) { return getResource (url); })
                       .withNativeFunction ("noteOn",  [this] (const auto& args, auto complete)
                                            { if (args.size() > 0) proc.keyboardState.noteOn (1, (int) args[0], 0.8f); complete (true); })
                       .withNativeFunction ("noteOff", [this] (const auto& args, auto complete)
                                            { if (args.size() > 0) proc.keyboardState.noteOff (1, (int) args[0], 0.f); complete (true); });
   #if JUCE_WINDOWS
    options = options.withBackend (WB::Options::Backend::webview2)
                     .withWinWebView2Options (WB::Options::WinWebView2{}
                         .withUserDataFolder (juce::File::getSpecialLocation (juce::File::tempDirectory)));
   #endif
    for (auto& r : relays) options = options.withOptionsFrom (*r);

    for (size_t i = 0; i < relays.size(); ++i)
    {
        auto* param = proc.apvts.getParameter (ParameterIDs::all[i]);
        jassert (param != nullptr);
        attachments.push_back (std::make_unique<juce::WebSliderParameterAttachment> (*param, *relays[i], nullptr));
    }

    web = std::make_unique<WB> (options);
    addAndMakeVisible (*web);
    web->goToURL (WB::getResourceProviderRoot());

    setResizable (true, true);
    setResizeLimits (kDefaultW * 3 / 4, kDefaultH * 3 / 4, kDefaultW * 2, kDefaultH * 2);
    getConstrainer()->setFixedAspectRatio ((double) kDefaultW / kDefaultH);
    setSize (kDefaultW, kDefaultH);
}

void MiniSynthEditor::resized() { if (web) web->setBounds (getLocalBounds()); }

std::optional<juce::WebBrowserComponent::Resource> MiniSynthEditor::getResource (const juce::String& url) const
{
    if (url == "/" || url == "/index.html")
    {
        std::vector<std::byte> bytes (BinaryData::index_htmlSize);
        std::memcpy (bytes.data(), BinaryData::index_html, bytes.size());
        return juce::WebBrowserComponent::Resource { std::move (bytes), juce::String ("text/html; charset=utf-8") };
    }
    return std::nullopt;
}
