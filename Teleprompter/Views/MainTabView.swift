import SwiftUI

struct MainTabView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            ScriptsListView()
                .tabItem {
                    Label("Scripts", systemImage: "doc.text")
                }
                .tag(0)

            VisualTimerView()
                .tabItem {
                    Label("Timer", systemImage: "timer")
                }
                .tag(1)

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gearshape")
                }
                .tag(2)
        }
        .tint(AppTheme.accent)
    }
}

#Preview {
    MainTabView()
        .environment(PlaybackSettings())
}
