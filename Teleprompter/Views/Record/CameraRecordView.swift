import SwiftUI
import Photos

struct CameraRecordView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(PlaybackSettings.self) private var settings

    let script: Script

    @State private var model = CameraRecordViewModel()
    @State private var showSettings = false
    @State private var saveMessage: String?

    var body: some View {
        ZStack {
            CameraPreviewView(session: model.camera.session)
                .ignoresSafeArea()

            TeleprompterScrollOverlay(
                text: script.body,
                scrollOffset: model.scrollOffset,
                textWidthFraction: settings.prompterWidthFraction,
                settings: settings
            )
            .allowsHitTesting(false)

            if let countdown = model.countdown {
                Text("\(countdown)")
                    .font(.system(size: 120, weight: .bold, design: .rounded))
                    .foregroundStyle(AppTheme.accent)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(.black.opacity(0.6))
            }

            VStack {
                topBar
                Spacer()
                bottomBar
            }
            .padding(.horizontal, 12)
            .padding(.top, 8)
            .padding(.bottom, 16)
        }
        .statusBarHidden(true)
        .persistentSystemOverlays(.hidden)
        .task {
            await model.start(settings: settings, scriptBody: script.body)
        }
        .onDisappear { model.stop() }
        .sheet(isPresented: $showSettings) {
            RecordSettingsSheet(settings: settings, formatLabel: model.camera.formatDescription)
        }
        .onChange(of: settings.videoQualityRaw) { _, _ in
            Task { await model.reconfigure(settings: settings, scriptBody: script.body) }
        }
        .onChange(of: settings.videoFps) { _, _ in
            Task { await model.reconfigure(settings: settings, scriptBody: script.body) }
        }
        .alert("Saved", isPresented: .init(
            get: { saveMessage != nil },
            set: { if !$0 { saveMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(saveMessage ?? "")
        }
    }

    private var topBar: some View {
        HStack {
            Button { dismiss() } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.title)
                    .symbolRenderingMode(.palette)
                    .foregroundStyle(.white, .white.opacity(0.3))
            }
            Spacer()
            Text(script.title)
                .font(.headline)
                .foregroundStyle(.white)
                .lineLimit(1)
            Spacer()
            Button { showSettings = true } label: {
                Image(systemName: "gearshape.fill")
                    .font(.title2)
                    .foregroundStyle(.white)
            }
            Button {
                Task { await model.flipCamera(settings: settings, scriptBody: script.body) }
            } label: {
                Image(systemName: "arrow.triangle.2.circlepath.camera.fill")
                    .font(.title2)
                    .foregroundStyle(.white)
            }
        }
    }

    private var bottomBar: some View {
        VStack(spacing: 12) {
            Text(model.camera.formatDescription)
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.7))

            HStack(spacing: 28) {
                Button { model.nudgeScroll(by: 60) } label: {
                    Image(systemName: "arrow.down.circle.fill")
                        .font(.system(size: 40))
                        .foregroundStyle(.white)
                }
                Button { model.toggleScroll(settings: settings) } label: {
                    Image(systemName: model.isScrolling ? "pause.circle.fill" : "play.circle.fill")
                        .font(.system(size: 72))
                        .foregroundStyle(AppTheme.accent)
                }
                Button { model.nudgeScroll(by: -60) } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 40))
                        .foregroundStyle(.white)
                }
            }

            Button {
                Task {
                    if let msg = await model.toggleRecording(settings: settings, scriptBody: script.body) {
                        saveMessage = msg
                    }
                }
            } label: {
                ZStack {
                    Circle().stroke(.white, lineWidth: 4).frame(width: 76, height: 76)
                    Circle()
                        .fill(model.isRecording ? .white : .red)
                        .frame(width: model.isRecording ? 32 : 62, height: model.isRecording ? 32 : 62)
                        .cornerRadius(model.isRecording ? 8 : 31)
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial.opacity(0.85))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

struct TeleprompterScrollOverlay: View {
    let text: String
    let scrollOffset: CGFloat
    let textWidthFraction: Double
    let settings: PlaybackSettings

    var body: some View {
        GeometryReader { geo in
            let width = geo.size.width * textWidthFraction
            let readY = geo.size.height * 0.16

            ZStack(alignment: .top) {
                if settings.readingLineGuide {
                    Rectangle()
                        .fill(AppTheme.accent.opacity(0.5))
                        .frame(height: 2)
                        .frame(width: width)
                        .position(x: geo.size.width / 2, y: readY)
                }

                VStack(spacing: 0) {
                    Spacer().frame(height: readY)
                    Text(text)
                        .font(.system(size: settings.fontSize * settings.fontScale * 0.55, weight: .semibold))
                        .foregroundStyle(settings.textColor)
                        .lineSpacing(settings.lineSpacing)
                        .multilineTextAlignment(.leading)
                        .padding(.horizontal, settings.marginHorizontal)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 6)
                        .background(settings.backgroundColor.opacity(0.52))
                        .scaleEffect(x: settings.mirrorHorizontal ? -1 : 1, y: 1)
                    Spacer()
                }
                .frame(width: width)
                .frame(maxWidth: .infinity)
                .offset(y: scrollOffset)
            }
        }
        .ignoresSafeArea()
    }
}

@Observable
@MainActor
final class CameraRecordViewModel {
    let camera = CameraSessionManager()
    private var writer: VideoRecordingWriter?
    private var scrollTimer: Timer?
    private var scriptBody = ""

    var scrollOffset: CGFloat = 0
    var isScrolling = false
    var isRecording = false
    var countdown: Int?

    func start(settings: PlaybackSettings, scriptBody: String) async {
        self.scriptBody = scriptBody
        wireCallbacks(settings: settings)
        do {
            try await camera.configure(preset: settings.videoQuality, fps: settings.videoFps)
            camera.start()
        } catch {
            camera.formatDescription = "Camera error"
        }
    }

    func stop() {
        scrollTimer?.invalidate()
        camera.stop()
        camera.isRecording = false
        writer = nil
    }

    func flipCamera(settings: PlaybackSettings, scriptBody: String) async {
        self.scriptBody = scriptBody
        await reconfigure(settings: settings, scriptBody: scriptBody)
    }

    func reconfigure(settings: PlaybackSettings, scriptBody: String) async {
        self.scriptBody = scriptBody
        let wasRecording = isRecording
        if wasRecording {
            _ = await stopRecording()
        }
        camera.stop()
        do {
            try await camera.configure(preset: settings.videoQuality, fps: settings.videoFps)
            wireCallbacks(settings: settings)
            camera.start()
        } catch {
            camera.formatDescription = "Camera error"
        }
    }

    private func wireCallbacks(settings: PlaybackSettings) {
        camera.onVideoSample = { [weak self] _, buffer, time in
            guard let self, self.isRecording, let writer = self.writer else { return }
            let offset = self.scrollOffset
            var layout = self.makeLayout(settings: settings)
            layout.scrollOffset = offset
            guard let frame = TeleprompterFrameCompositor.composite(cameraBuffer: buffer, layout: layout) else { return }
            writer.appendVideo(pixelBuffer: frame, presentationTime: time)
        }
        camera.onAudioSample = { [weak self] sample in
            self?.writer?.appendAudio(sampleBuffer: sample)
        }
    }

    private func makeLayout(settings: PlaybackSettings) -> TeleprompterLayoutConfig {
        TeleprompterLayoutConfig(
            script: scriptBody,
            scrollOffset: scrollOffset,
            fontSize: CGFloat(settings.fontSize * settings.fontScale * 0.55),
            lineSpacing: CGFloat(settings.lineSpacing),
            margin: CGFloat(settings.marginHorizontal),
            textColor: UIColor(settings.textColor),
            backgroundColor: UIColor(settings.backgroundColor),
            mirror: settings.mirrorHorizontal,
            textWidthFraction: CGFloat(settings.prompterWidthFraction)
        )
    }

    func toggleRecording(settings: PlaybackSettings, scriptBody: String) async -> String? {
        self.scriptBody = scriptBody
        if isRecording { return await stopRecording() }
        await startRecording(settings: settings)
        return nil
    }

    private func startRecording(settings: PlaybackSettings) {
        let w = VideoRecordingWriter()
        do {
            try w.start(
                size: camera.videoDimensions,
                fps: settings.videoFps,
                bitrate: settings.videoQuality.targetBitrate
            )
            writer = w
            camera.isRecording = true
            isRecording = true
            wireCallbacks(settings: settings)
        } catch {
            camera.formatDescription = "Record failed"
        }
    }

    private func stopRecording() async -> String? {
        camera.isRecording = false
        isRecording = false
        guard let writer else { return nil }
        self.writer = nil
        do {
            let url = try await writer.finish()
            try await saveToPhotos(url: url)
            return "Video saved to Photos."
        } catch {
            return error.localizedDescription
        }
    }

    private func saveToPhotos(url: URL) async throws {
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else { throw SaveError.denied }
        try await PHPhotoLibrary.shared().performChanges {
            PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: url)
        }
    }

    enum SaveError: Error { case denied }

    func toggleScroll(settings: PlaybackSettings) {
        if isScrolling { stopScroll() }
        else if scrollOffset >= -2 {
            runCountdown(settings: settings) { [weak self] in self?.startScroll(settings: settings) }
        } else { startScroll(settings: settings) }
    }

    private func runCountdown(settings: PlaybackSettings, then: @escaping () -> Void) {
        var n = settings.countdownSeconds
        guard n > 0 else { then(); return }
        countdown = n
        Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] t in
            Task { @MainActor in
                n -= 1
                if n > 0 { self?.countdown = n }
                else { t.invalidate(); self?.countdown = nil; then() }
            }
        }
    }

    func startScroll(settings: PlaybackSettings) {
        isScrolling = true
        scrollTimer?.invalidate()
        scrollTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 60.0, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.scrollOffset -= CGFloat(settings.scrollSpeed) / 60 }
        }
    }

    func stopScroll() {
        isScrolling = false
        scrollTimer?.invalidate()
    }

    func nudgeScroll(by delta: CGFloat) {
        stopScroll()
        scrollOffset += delta
    }
}
