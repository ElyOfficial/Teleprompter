import SwiftUI

struct ScriptGridCard: View {
    let script: Script
    @State private var showPlayer = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .bottomTrailing) {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(AppTheme.card)
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(AppTheme.cardBorder, lineWidth: 1)
                    )
                    .aspectRatio(1, contentMode: .fit)
                    .overlay(alignment: .topLeading) {
                        Text(script.preview)
                            .font(.system(size: 7, weight: .regular, design: .default))
                            .foregroundStyle(.white.opacity(0.75))
                            .lineLimit(14)
                            .multilineTextAlignment(.leading)
                            .padding(8)
                    }

                Button {
                    showPlayer = true
                } label: {
                    Image(systemName: "play.fill")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.black)
                        .padding(8)
                        .background(AppTheme.accent)
                        .clipShape(Circle())
                }
                .padding(8)
                .accessibilityLabel("Play \(script.title)")
            }

            Text(script.title)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.white)
                .lineLimit(1)
        }
        .fullScreenCover(isPresented: $showPlayer) {
            TeleprompterView(script: script)
        }
    }
}
