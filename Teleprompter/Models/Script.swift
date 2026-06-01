import Foundation
import SwiftData

@Model
final class Script {
    var id: UUID
    var title: String
    var body: String
    var createdAt: Date
    var updatedAt: Date

    init(title: String, body: String) {
        self.id = UUID()
        self.title = title
        self.body = body
        self.createdAt = Date()
        self.updatedAt = Date()
    }

    var preview: String {
        let trimmed = body.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return "Empty script" }
        return String(trimmed.prefix(180))
    }

    func touch() {
        updatedAt = Date()
    }
}

extension Script: Identifiable {}
