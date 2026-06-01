import SwiftUI
import SwiftData

struct ScriptsListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Script.updatedAt, order: .reverse) private var scripts: [Script]

    @State private var searchText = ""
    @State private var editorScript: Script?
    @State private var isCreating = false

    private var filtered: [Script] {
        guard !searchText.isEmpty else { return scripts }
        return scripts.filter {
            $0.title.localizedCaseInsensitiveContains(searchText)
                || $0.body.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    searchField

                    if scripts.isEmpty {
                        emptyState
                    } else if filtered.isEmpty {
                        Text("No scripts match your search.")
                            .foregroundStyle(AppTheme.secondaryText)
                            .padding(.top, 8)
                    } else {
                        scriptsSection
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 24)
            }
            .background(AppTheme.background.ignoresSafeArea())
            .navigationTitle("Scripts")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        isCreating = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .symbolRenderingMode(.palette)
                            .foregroundStyle(AppTheme.accent, AppTheme.card)
                            .font(.title2)
                    }
                    .accessibilityLabel("New script")
                }
            }
            .sheet(isPresented: $isCreating) {
                ScriptEditorView(script: nil)
            }
            .sheet(item: $editorScript) { script in
                ScriptEditorView(script: script)
            }
            .onAppear(perform: seedDemoIfNeeded)
        }
    }

    private var searchField: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(AppTheme.secondaryText)
            TextField("Search", text: $searchText)
                .foregroundStyle(.white)
        }
        .searchBarStyle()
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("No scripts yet")
                .font(.headline)
                .foregroundStyle(.white)
            Text("Tap + to write your first script, then open it to start the teleprompter.")
                .font(.subheadline)
                .foregroundStyle(AppTheme.secondaryText)
        }
        .padding(.top, 8)
    }

    private var scriptsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Scripts")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(.white)
                Spacer()
                Text("\(filtered.count)")
                    .font(.subheadline)
                    .foregroundStyle(AppTheme.secondaryText)
            }

            LazyVGrid(
                columns: [
                    GridItem(.flexible(), spacing: 12),
                    GridItem(.flexible(), spacing: 12),
                    GridItem(.flexible(), spacing: 12)
                ],
                spacing: 16
            ) {
                ForEach(filtered, id: \.id) { script in
                    ScriptGridCard(script: script)
                        .contextMenu {
                            Button("Edit") { editorScript = script }
                            Button("Delete", role: .destructive) {
                                modelContext.delete(script)
                            }
                        }
                }
            }
        }
    }

    private func seedDemoIfNeeded() {
        guard scripts.isEmpty else { return }
        let demo = Script(
            title: "Welcome",
            body: """
            Welcome to your personal teleprompter.

            Tap Play on this card to open full-screen scroll. Tap the center to pause or resume. Swipe up or down while paused to adjust your place in the script.

            Open Settings to change font size, scroll speed, colors, and mirror mode for glass teleprompters.

            Happy recording!
            """
        )
        modelContext.insert(demo)
    }
}

#Preview {
    ScriptsListView()
        .modelContainer(for: Script.self, inMemory: true)
        .environment(PlaybackSettings())
}
