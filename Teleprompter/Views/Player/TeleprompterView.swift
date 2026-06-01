import SwiftUI

struct TeleprompterView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(PlaybackSettings.self) private var settings

    let script: Script

    @State private var scrollOffset: CGFloat = 0
    @State private var contentHeight: CGFloat = 0
    @State private var viewportHeight: CGFloat = 0
    @State private var isPlaying = false
    @State private var showControls = true
    @State private var countdown: Int?
    @State private var scrollTimer: Timer?

    private var maxScroll: CGFloat {
        max(0, contentHeight + viewportHeight)
    }

    var body: some View {
        @Bindable var settings = settings

        return GeometryReader { geo in
            ZStack {
                settings.backgroundColor.ignoresSafeArea()

                scrollLayer(size: geo.size)

                if settings.readingLineGuide {
                    readingLine(in: geo.size)
                }

                if let countdown {
                    countdownOverlay(countdown)
                }

                if showControls {
                    controlsOverlay
                }
            }
            .onAppear {
                viewportHeight = geo.size.height
                resetScrollPosition()
            }
            .onChange(of: geo.size.height) { _, h in
                viewportHeight = h
            }
            .contentShape(Rectangle())
            .onTapGesture {
                if countdown != nil { return }
                withAnimation(.easeInOut(duration: 0.2)) {
                    showControls.toggle()
                }
            }
            .gesture(
                DragGesture()
                    .onChanged { value in
                        guard !isPlaying, countdown == nil else { return }
                        scrollOffset = clamp(scrollOffset + value.translation.height)
                    }
            )
        }
        .statusBarHidden(true)
        .persistentSystemOverlays(.hidden)
        .onDisappear { stopScrolling() }
    }

    // MARK: - Scroll content

    private func scrollLayer(size: CGSize) -> some View {
        VStack(spacing: 0) {
            Color.clear.frame(height: size.height * 0.42)

            Text(script.body)
                .font(.system(size: settings.fontSize, weight: .medium))
                .foregroundStyle(settings.textColor)
                .lineSpacing(settings.lineSpacing)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, settings.marginHorizontal)
                .background(
                    GeometryReader { textGeo in
                        Color.clear
                            .preference(key: TextHeightKey.self, value: textGeo.size.height)
                    }
                )
                .scaleEffect(x: settings.mirrorHorizontal ? -1 : 1, y: 1)

            Color.clear.frame(height: size.height * 0.55)
        }
        .frame(maxWidth: .infinity, alignment: .top)
        .offset(y: scrollOffset)
        .onPreferenceChange(TextHeightKey.self) { contentHeight = $0 }
    }

    private func readingLine(in size: CGSize) -> some View {
        let y = size.height * 0.38
        return ZStack {
            Rectangle()
                .fill(AppTheme.accent.opacity(0.35))
                .frame(height: 2)
                .position(x: size.width / 2, y: y)
            HStack {
                Circle().fill(AppTheme.accent).frame(width: 8, height: 8)
                Spacer()
                Circle().fill(AppTheme.accent).frame(width: 8, height: 8)
            }
            .padding(.horizontal, 24)
            .position(x: size.width / 2, y: y)
        }
        .allowsHitTesting(false)
    }

    // MARK: - Controls

    private var controlsOverlay: some View {
        VStack {
            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title)
                        .symbolRenderingMode(.palette)
                        .foregroundStyle(.white, .white.opacity(0.25))
                }
                Spacer()
                Text(script.title)
                    .font(.headline)
                    .foregroundStyle(.white.opacity(0.9))
                    .lineLimit(1)
                Spacer()
                Color.clear.frame(width: 28, height: 28)
            }
            .padding()

            Spacer()

            HStack(spacing: 28) {
                Button { nudge(by: 80) } label: {
                    Image(systemName: "arrow.down.circle.fill")
                        .font(.system(size: 44))
                        .foregroundStyle(.white.opacity(0.85))
                }

                Button { togglePlayback() } label: {
                    Image(systemName: isPlaying ? "pause.circle.fill" : "play.circle.fill")
                        .font(.system(size: 72))
                        .foregroundStyle(AppTheme.accent)
                }

                Button { nudge(by: -80) } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 44))
                        .foregroundStyle(.white.opacity(0.85))
                }
            }
            .padding(.bottom, 40)

            VStack(spacing: 6) {
                Text("Speed")
                    .font(.caption)
                    .foregroundStyle(AppTheme.secondaryText)
                Slider(value: $settings.scrollSpeed, in: 10...120)
                .tint(AppTheme.accent)
                .padding(.horizontal, 32)
            }
            .padding(.bottom, 24)
        }
        .background(
            LinearGradient(
                colors: [.black.opacity(0.55), .clear, .clear, .black.opacity(0.55)],
                startPoint: .top,
                endPoint: .bottom
            )
            .allowsHitTesting(false)
        )
    }

    private func countdownOverlay(_ value: Int) -> some View {
        ZStack {
            Color.black.opacity(0.6).ignoresSafeArea()
            Text("\(value)")
                .font(.system(size: 120, weight: .bold, design: .rounded))
                .foregroundStyle(AppTheme.accent)
        }
    }

    // MARK: - Playback

    private func togglePlayback() {
        if isPlaying {
            stopScrolling()
        } else if countdown != nil {
            return
        } else if settings.countdownSeconds > 0, scrollOffset >= -1 {
            beginCountdown()
        } else {
            startScrolling()
        }
    }

    private func beginCountdown() {
        var remaining = settings.countdownSeconds
        countdown = remaining
        Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { timer in
            remaining -= 1
            if remaining > 0 {
                countdown = remaining
            } else {
                timer.invalidate()
                countdown = nil
                startScrolling()
            }
        }
    }

    private func startScrolling() {
        isPlaying = true
        UIApplication.shared.isIdleTimerDisabled = true
        scrollTimer?.invalidate()
        scrollTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 60.0, repeats: true) { _ in
            let step = CGFloat(settings.scrollSpeed) / 60.0
            scrollOffset -= step
            if scrollOffset < -maxScroll {
                stopScrolling()
            }
        }
    }

    private func stopScrolling() {
        isPlaying = false
        scrollTimer?.invalidate()
        scrollTimer = nil
        UIApplication.shared.isIdleTimerDisabled = false
    }

    private func resetScrollPosition() {
        scrollOffset = 0
    }

    private func nudge(by delta: CGFloat) {
        stopScrolling()
        scrollOffset = clamp(scrollOffset + delta)
    }

    private func clamp(_ value: CGFloat) -> CGFloat {
        min(0, max(-maxScroll, value))
    }
}
