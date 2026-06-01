import SwiftUI

enum AppTheme {
    static let background = Color(red: 0.07, green: 0.07, blue: 0.07)
    static let card = Color(red: 0.17, green: 0.17, blue: 0.18)
    static let cardBorder = Color.white.opacity(0.08)
    static let accent = Color(red: 1.0, green: 0.62, blue: 0.04)
    static let secondaryText = Color.white.opacity(0.55)
    static let sectionHeader = Color.white.opacity(0.45)

    static let tabBar = Color(red: 0.11, green: 0.11, blue: 0.12)
}

struct SearchBarStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(.horizontal, 14)
            .padding(.vertical, 11)
            .background(AppTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

extension View {
    func searchBarStyle() -> some View { modifier(SearchBarStyle()) }
}
