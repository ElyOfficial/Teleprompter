import SwiftUI
import SwiftData

struct ScriptEditorView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    let script: Script?

    @State private var title: String = ""
    @State private var bodyText: String = ""
    @State private var showPlayer = false
    @State private var savedScript: Script?

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                TextField("Title", text: $title)
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding()

                Divider().overlay(AppTheme.cardBorder)

                TextEditor(text: $bodyText)
                    .scrollContentBackground(.hidden)
                    .foregroundStyle(.white)
                    .font(.body)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
            }
            .background(AppTheme.background.ignoresSafeArea())
            .navigationTitle(script == nil ? "New Script" : "Edit Script")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save(); dismiss() }
                        .fontWeight(.semibold)
                        .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                ToolbarItem(placement: .bottomBar) {
                    Button {
                        guard save() != nil else { return }
                        showPlayer = true
                    } label: {
                        Label("Play", systemImage: "play.fill")
                    }
                    .disabled(bodyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .onAppear {
                if let script {
                    title = script.title
                    bodyText = script.body
                }
            }
            .fullScreenCover(isPresented: $showPlayer) {
                if let savedScript {
                    TeleprompterView(script: savedScript)
                }
            }
        }
    }

    @discardableResult
    private func save() -> Script? {
        let trimmedTitle = title.trimmingCharacters(in: .whitespaces)
        guard !trimmedTitle.isEmpty else { return nil }

        if let script {
            script.title = trimmedTitle
            script.body = bodyText
            script.touch()
            savedScript = script
            return script
        } else if let savedScript {
            savedScript.title = trimmedTitle
            savedScript.body = bodyText
            savedScript.touch()
            return savedScript
        } else {
            let newScript = Script(title: trimmedTitle, body: bodyText)
            modelContext.insert(newScript)
            self.savedScript = newScript
            return newScript
        }
    }
}
