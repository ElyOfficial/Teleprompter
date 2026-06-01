import CoreImage
import UIKit
import AVFoundation

struct TeleprompterLayoutConfig {
    var script: String
    var scrollOffset: CGFloat
    var fontSize: CGFloat
    var lineSpacing: CGFloat
    var margin: CGFloat
    var textColor: UIColor
    var backgroundColor: UIColor
    var mirror: Bool
    var textWidthFraction: CGFloat
    var readingLineFraction: CGFloat = 0.16
}

enum TeleprompterFrameCompositor {
    private static let ciContext = CIContext(options: [.useSoftwareRenderer: false])

    static func composite(
        cameraBuffer: CVPixelBuffer,
        layout: TeleprompterLayoutConfig
    ) -> CVPixelBuffer? {
        let width = CVPixelBufferGetWidth(cameraBuffer)
        let height = CVPixelBufferGetHeight(cameraBuffer)
        var output: CVPixelBuffer?
        let attrs: [String: Any] = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey as String: width,
            kCVPixelBufferHeightKey as String: height,
        ]
        guard CVPixelBufferCreate(
            kCFAllocatorDefault, width, height, kCVPixelFormatType_32BGRA,
            attrs as CFDictionary, &output
        ) == kCVReturnSuccess, let out = output else { return nil }

        ciContext.render(CIImage(cvPixelBuffer: cameraBuffer), to: out)

        CVPixelBufferLockBaseAddress(out, [])
        defer { CVPixelBufferUnlockBaseAddress(out, []) }
        guard let ctx = CGContext(
            data: CVPixelBufferGetBaseAddress(out),
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(out),
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
        ) else { return nil }

        ctx.translateBy(x: 0, y: CGFloat(height))
        ctx.scaleBy(x: 1, y: -1)
        drawTeleprompter(in: ctx, size: CGSize(width: width, height: height), layout: layout)
        return out
    }

    private static func drawTeleprompter(
        in ctx: CGContext,
        size: CGSize,
        layout: TeleprompterLayoutConfig
    ) {
        let textWidth = size.width * layout.textWidthFraction
        let left = (size.width - textWidth) / 2
        let readY = size.height * layout.readingLineFraction

        let font = UIFont.systemFont(ofSize: layout.fontSize, weight: .semibold)
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineSpacing = layout.lineSpacing
        paragraph.alignment = .left

        let attrs: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: layout.textColor,
            .paragraphStyle: paragraph,
        ]
        let attributed = NSAttributedString(string: layout.script, attributes: attrs)
        let drawRect = CGRect(
            x: left + layout.margin,
            y: readY + layout.scrollOffset,
            width: textWidth - layout.margin * 2,
            height: size.height * 3
        )

        ctx.saveGState()
        if layout.mirror {
            ctx.translateBy(x: left + textWidth, y: 0)
            ctx.scaleBy(x: -1, y: 1)
            ctx.translateBy(x: -(left + textWidth), y: 0)
        }
        UIGraphicsPushContext(ctx)
        attributed.draw(with: drawRect, options: [.usesLineFragmentOrigin], context: nil)
        UIGraphicsPopContext()
        ctx.restoreGState()
    }
}
