import AVFoundation
import UIKit

@Observable
final class CameraSessionManager: NSObject {
    let session = AVCaptureSession()
    private let sessionQueue = DispatchQueue(label: "camera.session.queue")
    private var videoInput: AVCaptureDeviceInput?
    private var audioInput: AVCaptureDeviceInput?
    private let videoOutput = AVCaptureVideoDataOutput()
    private let audioOutput = AVCaptureAudioDataOutput()

    private(set) var position: AVCaptureDevice.Position = .front
    private(set) var formatDescription: String = "Configuring…"

    func reportStatus(_ message: String) {
        formatDescription = message
    }
    private(set) var videoDimensions: CMVideoDimensions = CMVideoDimensions(width: 1920, height: 1080)

    var isRecording = false
    var onVideoSample: ((CMSampleBuffer, CVPixelBuffer, CMTime) -> Void)?
    var onAudioSample: ((CMSampleBuffer) -> Void)?

    private var configuredPreset: VideoQualityPreset = .hd1080
    private var configuredFPS: Int = 30

    func configure(preset: VideoQualityPreset, fps: Int) async throws {
        configuredPreset = preset
        configuredFPS = fps
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            sessionQueue.async {
                do {
                    try self.configureSession(preset: preset, fps: fps)
                    cont.resume()
                } catch {
                    cont.resume(throwing: error)
                }
            }
        }
    }

    func start() {
        sessionQueue.async {
            guard !self.session.isRunning else { return }
            self.session.startRunning()
        }
    }

    func stop() {
        sessionQueue.async {
            guard self.session.isRunning else { return }
            self.session.stopRunning()
        }
    }

    func flipCamera(preset: VideoQualityPreset, fps: Int) async throws {
        position = position == .front ? .back : .front
        try await configure(preset: preset, fps: fps)
        start()
    }

    private func configureSession(preset: VideoQualityPreset, fps: Int) throws {
        session.beginConfiguration()
        defer { session.commitConfiguration() }

        session.inputs.forEach { session.removeInput($0) }
        session.outputs.forEach { session.removeOutput($0) }

        session.sessionPreset = .inputPriority

        guard let videoDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position)
        else { throw CameraError.noCamera }

        try videoDevice.lockForConfiguration()
        if let format = Self.bestFormat(for: videoDevice, preset: preset, fps: fps) {
            videoDevice.activeFormat = format
            let duration = CMTime(value: 1, timescale: Int32(fps))
            videoDevice.activeVideoMinFrameDuration = duration
            videoDevice.activeVideoMaxFrameDuration = duration
            let dims = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
            videoDimensions = dims
            formatDescription = "\(dims.width)×\(dims.height) · \(fps) fps · \(preset.displayName)"
        } else {
            videoDimensions = preset.targetDimensions
            formatDescription = "\(preset.displayName) · \(fps) fps (fallback)"
        }
        if videoDevice.isFocusModeSupported(.continuousAutoFocus) {
            videoDevice.focusMode = .continuousAutoFocus
        }
        if videoDevice.isExposureModeSupported(.continuousAutoExposure) {
            videoDevice.exposureMode = .continuousAutoExposure
        }
        videoDevice.unlockForConfiguration()

        let videoIn = try AVCaptureDeviceInput(device: videoDevice)
        guard session.canAddInput(videoIn) else { throw CameraError.cannotAddInput }
        session.addInput(videoIn)
        videoInput = videoIn

        if let audioDevice = AVCaptureDevice.default(for: .audio) {
            let audioIn = try AVCaptureDeviceInput(device: audioDevice)
            if session.canAddInput(audioIn) {
                session.addInput(audioIn)
                audioInput = audioIn
            }
        }

        videoOutput.videoSettings = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        ]
        videoOutput.alwaysDiscardsLateVideoFrames = true
        videoOutput.setSampleBufferDelegate(self, queue: sessionQueue)
        guard session.canAddOutput(videoOutput) else { throw CameraError.cannotAddOutput }
        session.addOutput(videoOutput)

        if let connection = videoOutput.connection(with: .video) {
            if connection.isVideoStabilizationSupported {
                connection.preferredVideoStabilizationMode = .cinematic
            }
            if connection.isVideoRotationAngleSupported(90) {
                connection.videoRotationAngle = 90
            }
            if connection.isVideoMirroringSupported, position == .front {
                connection.isVideoMirrored = true
            }
        }

        audioOutput.setSampleBufferDelegate(self, queue: sessionQueue)
        if session.canAddOutput(audioOutput) {
            session.addOutput(audioOutput)
        }
    }

    private static func bestFormat(
        for device: AVCaptureDevice,
        preset: VideoQualityPreset,
        fps: Int
    ) -> AVCaptureDevice.Format? {
        let target = preset.targetDimensions
        let candidates = device.formats.filter { format in
            let dims = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
            guard dims.width >= target.width, dims.height >= target.height else { return false }
            return format.videoSupportedFrameRateRanges.contains { $0.maxFrameRate >= Double(fps) }
        }
        return candidates.max { a, b in
            let da = CMVideoFormatDescriptionGetDimensions(a.formatDescription)
            let db = CMVideoFormatDescriptionGetDimensions(b.formatDescription)
            return da.width * da.height < db.width * db.height
        }
    }

    enum CameraError: Error {
        case noCamera
        case cannotAddInput
        case cannotAddOutput
    }
}

extension CameraSessionManager: AVCaptureVideoDataOutputSampleBufferDelegate, AVCaptureAudioDataOutputSampleBufferDelegate {
    func captureOutput(
        _ output: AVCaptureOutput,
        didOutput sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        if output == videoOutput {
            guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
            let time = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
            onVideoSample?(sampleBuffer, pixelBuffer, time)
        } else if output == audioOutput, isRecording {
            onAudioSample?(sampleBuffer)
        }
    }
}
