import SwiftUI
import UIKit

@Observable
final class PlaybackSettings {
    var fontSize: Double {
        didSet { UserDefaults.standard.set(fontSize, forKey: Keys.fontSize) }
    }
    var lineSpacing: Double {
        didSet { UserDefaults.standard.set(lineSpacing, forKey: Keys.lineSpacing) }
    }
    var scrollSpeed: Double {
        didSet { UserDefaults.standard.set(scrollSpeed, forKey: Keys.scrollSpeed) }
    }
    var countdownSeconds: Int {
        didSet { UserDefaults.standard.set(countdownSeconds, forKey: Keys.countdownSeconds) }
    }
    var mirrorHorizontal: Bool {
        didSet { UserDefaults.standard.set(mirrorHorizontal, forKey: Keys.mirrorHorizontal) }
    }
    var marginHorizontal: Double {
        didSet { UserDefaults.standard.set(marginHorizontal, forKey: Keys.marginHorizontal) }
    }
    var readingLineGuide: Bool {
        didSet { UserDefaults.standard.set(readingLineGuide, forKey: Keys.readingLineGuide) }
    }

    var textColorHex: String {
        didSet { UserDefaults.standard.set(textColorHex, forKey: Keys.textColorHex) }
    }
    var backgroundColorHex: String {
        didSet { UserDefaults.standard.set(backgroundColorHex, forKey: Keys.backgroundColorHex) }
    }

    var videoQualityRaw: String {
        didSet { UserDefaults.standard.set(videoQualityRaw, forKey: Keys.videoQuality) }
    }
    var videoFps: Int {
        didSet { UserDefaults.standard.set(videoFps, forKey: Keys.videoFps) }
    }
    var prompterWidthFraction: Double {
        didSet { UserDefaults.standard.set(prompterWidthFraction, forKey: Keys.prompterWidth) }
    }
    var fontScale: Double {
        didSet { UserDefaults.standard.set(fontScale, forKey: Keys.fontScale) }
    }

    var videoQuality: VideoQualityPreset {
        get { VideoQualityPreset(rawValue: videoQualityRaw) ?? .hd1080 }
        set { videoQualityRaw = newValue.rawValue }
    }

    var textColor: Color {
        get { Color(hex: textColorHex) ?? .white }
        set { textColorHex = newValue.toHex() ?? "FFFFFFFF" }
    }

    var backgroundColor: Color {
        get { Color(hex: backgroundColorHex) ?? .black }
        set { backgroundColorHex = newValue.toHex() ?? "FF000000" }
    }

    init() {
        let d = UserDefaults.standard
        fontSize = d.object(forKey: Keys.fontSize) as? Double ?? 52
        lineSpacing = d.object(forKey: Keys.lineSpacing) as? Double ?? 12
        scrollSpeed = d.object(forKey: Keys.scrollSpeed) as? Double ?? 42
        countdownSeconds = d.object(forKey: Keys.countdownSeconds) as? Int ?? 3
        mirrorHorizontal = d.bool(forKey: Keys.mirrorHorizontal)
        marginHorizontal = d.object(forKey: Keys.marginHorizontal) as? Double ?? 28
        readingLineGuide = d.object(forKey: Keys.readingLineGuide) as? Bool ?? true
        textColorHex = d.string(forKey: Keys.textColorHex) ?? "FFFFFFFF"
        backgroundColorHex = d.string(forKey: Keys.backgroundColorHex) ?? "FF000000"
        videoQualityRaw = d.string(forKey: Keys.videoQuality) ?? VideoQualityPreset.hd1080.rawValue
        videoFps = d.object(forKey: Keys.videoFps) as? Int ?? 30
        prompterWidthFraction = d.object(forKey: Keys.prompterWidth) as? Double ?? 0.92
        fontScale = d.object(forKey: Keys.fontScale) as? Double ?? 1.0
    }

    private enum Keys {
        static let fontSize = "fontSize"
        static let lineSpacing = "lineSpacing"
        static let scrollSpeed = "scrollSpeed"
        static let countdownSeconds = "countdownSeconds"
        static let mirrorHorizontal = "mirrorHorizontal"
        static let marginHorizontal = "marginHorizontal"
        static let readingLineGuide = "readingLineGuide"
        static let textColorHex = "textColorHex"
        static let backgroundColorHex = "backgroundColorHex"
        static let videoQuality = "videoQuality"
        static let videoFps = "videoFps"
        static let prompterWidth = "prompterWidthFraction"
        static let fontScale = "fontScale"
    }
}

extension Color {
    init?(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 8, let value = UInt64(s, radix: 16) else { return nil }
        let a = Double((value >> 24) & 0xFF) / 255
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b, opacity: a)
    }

    func toHex() -> String? {
        guard let components = UIColor(self).cgColor.components else { return nil }
        let r, g, b, a: CGFloat
        if components.count >= 4 {
            r = components[0]; g = components[1]; b = components[2]; a = components[3]
        } else if components.count >= 2 {
            r = components[0]; g = components[0]; b = components[0]; a = components[1]
        } else { return nil }
        return String(
            format: "%02X%02X%02X%02X",
            Int(a * 255), Int(r * 255), Int(g * 255), Int(b * 255)
        )
    }
}
