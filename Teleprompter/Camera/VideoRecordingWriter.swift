import AVFoundation

final class VideoRecordingWriter {
    private var writer: AVAssetWriter?
    private var videoInput: AVAssetWriterInput?
    private var audioInput: AVAssetWriterInput?
    private var adaptor: AVAssetWriterInputPixelBufferAdaptor?
    private var startTime: CMTime?
    private let queue = DispatchQueue(label: "video.writer")

    private(set) var outputURL: URL?

    func start(
        size: CMVideoDimensions,
        fps: Int,
        bitrate: Int,
        audioSampleRate: Double = 44_100
    ) throws {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("take-\(UUID().uuidString).mov")
        outputURL = url
        try? FileManager.default.removeItem(at: url)

        let writer = try AVAssetWriter(outputURL: url, fileType: .mov)

        let compression: [String: Any] = [
            AVVideoAverageBitRateKey: bitrate,
            AVVideoExpectedSourceFrameRateKey: fps,
            AVVideoMaxKeyFrameIntervalKey: fps,
            AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        ]
        let videoSettings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: size.width,
            AVVideoHeightKey: size.height,
            AVVideoCompressionPropertiesKey: compression,
        ]

        let videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
        videoInput.expectsMediaDataInRealTime = true

        let sourceAttrs: [String: Any] = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey as String: size.width,
            kCVPixelBufferHeightKey as String: size.height,
        ]
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: videoInput,
            sourcePixelBufferAttributes: sourceAttrs
        )

        let audioSettings: [String: Any] = [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: audioSampleRate,
            AVNumberOfChannelsKey: 1,
            AVEncoderBitRateKey: 192_000,
        ]
        let audioInput = AVAssetWriterInput(mediaType: .audio, outputSettings: audioSettings)
        audioInput.expectsMediaDataInRealTime = true

        guard writer.canAdd(videoInput), writer.canAdd(audioInput) else {
            throw RecordingError.cannotAddInputs
        }
        writer.add(videoInput)
        writer.add(audioInput)
        writer.startWriting()

        self.writer = writer
        self.videoInput = videoInput
        self.audioInput = audioInput
        self.adaptor = adaptor
        self.startTime = nil
    }

    func appendVideo(pixelBuffer: CVPixelBuffer, presentationTime: CMTime) {
        queue.async { [weak self] in
            guard let self, let writer, let videoInput, let adaptor else { return }
            if startTime == nil {
                startTime = presentationTime
                writer.startSession(atSourceTime: presentationTime)
            }
            guard videoInput.isReadyForMoreMediaData else { return }
            adaptor.append(pixelBuffer, withPresentationTime: presentationTime)
        }
    }

    func appendAudio(sampleBuffer: CMSampleBuffer) {
        queue.async { [weak self] in
            guard let self, let audioInput, audioInput.isReadyForMoreMediaData else { return }
            audioInput.append(sampleBuffer)
        }
    }

    func finish() async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            queue.async { [weak self] in
                guard let self, let writer, let url = outputURL else {
                    continuation.resume(throwing: RecordingError.notStarted)
                    return
                }
                videoInput?.markAsFinished()
                audioInput?.markAsFinished()
                writer.finishWriting {
                    if writer.status == .completed {
                        continuation.resume(returning: url)
                    } else {
                        continuation.resume(throwing: writer.error ?? RecordingError.failed)
                    }
                }
            }
        }
    }

    enum RecordingError: Error {
        case cannotAddInputs
        case notStarted
        case failed
    }
}
