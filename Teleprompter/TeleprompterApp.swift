import SwiftUI
import SwiftData

@main
struct TeleprompterApp: App {
    @State private var playbackSettings = PlaybackSettings()

    var sharedModelContainer: ModelContainer = {
        let schema = Schema([Script.self])
        let config = ModelConfiguration(isStoredInMemoryOnly: false)
        do {
            return try ModelContainer(for: schema, configurations: [config])
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            MainTabView()
                .environment(playbackSettings)
                .preferredColorScheme(.dark)
        }
        .modelContainer(sharedModelContainer)
    }
}
