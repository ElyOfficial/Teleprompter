import AVFoundation

enum VideoQualityPreset: String, CaseIterable, Identifiable, Hashable {
    case hd720 = "720p"
    case hd1080 = "1080p"
    case uhd4K = "4K"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .hd720: "HD 720p"
        case .hd1080: "Full HD 1080p"
        case .uhd4K: "4K (max device)"
        }
    }

    var targetDimensions: CMVideoDimensions {
        switch self {
        case .hd720: CMVideoDimensions(width: 1280, height: 720)
        case .hd1080: CMVideoDimensions(width: 1920, height: 1080)
        case .uhd4K: CMVideoDimensions(width: 3840, height: 2160)
        }
    }

    var targetBitrate: Int {
        switch self {
        case .hd720: 8_000_000
        case .hd1080: 18_000_000
        case .uhd4K: 40_000_000
        }
    }
}

enum VideoFrameRate: Int, CaseIterable, Identifiable {
    case fps24 = 24
    case fps30 = 30
    case fps60 = 60

    var id: Int { rawValue }
    var label: String { "\(rawValue) fps" }
}
