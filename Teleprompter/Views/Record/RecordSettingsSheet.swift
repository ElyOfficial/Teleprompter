import SwiftUI

struct RecordSettingsSheet: View {
    @Bindable var settings: PlaybackSettings
    let formatLabel: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("CAMERA") {
                    Picker("Quality", selection: Binding(
                        get: { settings.videoQuality },
                        set: { settings.videoQuality = $0 }
                    )) {
                        ForEach(VideoQualityPreset.allCases) { q in
                            Text(q.displayName).tag(q)
                        }
                    }
                    Picker("Frame rate", selection: $settings.videoFps) {
                        ForEach(VideoFrameRate.allCases) { f in
                            Text(f.label).tag(f.rawValue)
                        }
                    }
                    Text(formatLabel)
                        .font(.caption)
                        .foregroundStyle(AppTheme.secondaryText)
                }

                Section("TEXT") {
                    row("Font size", value: $settings.fontSize, range: 24...96)
                    row("Line spacing", value: $settings.lineSpacing, range: 0...32)
                    row("Margin", value: $settings.marginHorizontal, range: 0...80)
                    row("Box width", value: Binding(
                        get: { settings.prompterWidthFraction * 100 },
                        set: { settings.prompterWidthFraction = $0 / 100 }
                    ), range: 55...98)
                }

                Section("PLAYBACK") {
                    row("Scroll speed", value: $settings.scrollSpeed, range: 10...120)
                    Stepper("Countdown: \(settings.countdownSeconds)s", value: $settings.countdownSeconds, in: 0...10)
                    Toggle("Reading line", isOn: $settings.readingLineGuide)
                    Toggle("Mirror text", isOn: $settings.mirrorHorizontal)
                }

                Section("COLOR") {
                    ColorPicker("Text", selection: $settings.textColor)
                    ColorPicker("Text background", selection: $settings.backgroundColor)
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func row(_ label: String, value: Binding<Double>, range: ClosedRange<Double>) -> some View {
        VStack(alignment: .leading) {
            HStack {
                Text(label)
                Spacer()
                Text("\(Int(value.wrappedValue))")
                    .foregroundStyle(AppTheme.accent)
                    .monospacedDigit()
            }
            Slider(value: value, in: range, step: 1)
                .tint(AppTheme.accent)
        }
    }
}
