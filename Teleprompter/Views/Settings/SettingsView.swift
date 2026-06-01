import SwiftUI

struct SettingsView: View {
    @Environment(PlaybackSettings.self) private var settings

    var body: some View {
        @Bindable var settings = settings

        return NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 12) {
                        labeledSlider("Font size", value: $settings.fontSize, range: 24...96, step: 1)
                        labeledSlider("Line spacing", value: $settings.lineSpacing, range: 0...32, step: 1)
                        labeledSlider("Side margins", value: $settings.marginHorizontal, range: 0...80, step: 2)
                    }
                    .listRowBackground(AppTheme.card)
                } header: {
                    sectionHeader("TEXT")
                }

                Section {
                    labeledSlider("Scroll speed", value: $settings.scrollSpeed, range: 10...120, step: 1)
                    Stepper("Countdown: \(settings.countdownSeconds)s", value: $settings.countdownSeconds, in: 0...10)
                    Toggle("Reading line guide", isOn: $settings.readingLineGuide)
                } header: {
                    sectionHeader("PLAYBACK")
                }
                .listRowBackground(AppTheme.card)

                Section {
                    colorRow("Text color", color: textColorBinding)
                    colorRow("Background", color: backgroundColorBinding)
                    Toggle("Mirror text (glass prompter)", isOn: $settings.mirrorHorizontal)
                } header: {
                    sectionHeader("COLOR")
                }
                .listRowBackground(AppTheme.card)

                Section {
                    previewBlock
                } header: {
                    sectionHeader("PREVIEW")
                }
                .listRowBackground(AppTheme.card)
            }
            .scrollContentBackground(.hidden)
            .background(AppTheme.background.ignoresSafeArea())
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.large)
        }
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.caption.weight(.semibold))
            .foregroundStyle(AppTheme.sectionHeader)
    }

    private func labeledSlider(
        _ label: String,
        value: Binding<Double>,
        range: ClosedRange<Double>,
        step: Double
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(label)
                    .foregroundStyle(.white)
                Spacer()
                Text("\(Int(value.wrappedValue))")
                    .foregroundStyle(AppTheme.accent)
                    .monospacedDigit()
            }
            Slider(value: value, in: range, step: step)
                .tint(AppTheme.accent)
        }
    }

    private var textColorBinding: Binding<Color> {
        Binding(get: { settings.textColor }, set: { settings.textColor = $0 })
    }

    private var backgroundColorBinding: Binding<Color> {
        Binding(get: { settings.backgroundColor }, set: { settings.backgroundColor = $0 })
    }

    private func colorRow(_ label: String, color: Binding<Color>) -> some View {
        HStack {
            Text(label)
            Spacer()
            ColorPicker("", selection: color, supportsOpacity: false)
                .labelsHidden()
        }
    }

    private var previewBlock: some View {
        ZStack {
            settings.backgroundColor
            Text("The quick brown fox jumps over the lazy dog.")
                .font(.system(size: min(settings.fontSize, 28), weight: .medium))
                .foregroundStyle(settings.textColor)
                .lineSpacing(settings.lineSpacing)
                .multilineTextAlignment(.center)
                .padding(settings.marginHorizontal)
                .scaleEffect(x: settings.mirrorHorizontal ? -1 : 1, y: 1)
        }
        .frame(height: 120)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

#Preview {
    SettingsView()
        .environment(PlaybackSettings())
}
