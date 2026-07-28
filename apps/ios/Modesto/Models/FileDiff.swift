import Foundation

/// Mirrors the shape of a working-tree file entry from `GitStatusResult`.
enum FileChangeKind: String, Codable, Sendable {
    case added
    case modified
    case deleted
    case renamed

    var symbolName: String {
        switch self {
        case .added: "plus.circle"
        case .modified: "pencil.circle"
        case .deleted: "minus.circle"
        case .renamed: "arrow.triangle.swap"
        }
    }

    var colorToken: ModestoColorToken {
        switch self {
        case .added: .success
        case .modified: .warning
        case .deleted: .danger
        case .renamed: .accent
        }
    }
}

struct ChangedFile: Identifiable, Codable, Sendable, Hashable {
    var id: String { path }
    var path: String
    var kind: FileChangeKind
    var additions: Int
    var deletions: Int
}

struct DiffLine: Identifiable, Codable, Sendable, Hashable {
    enum Kind: String, Codable, Sendable {
        case context
        case addition
        case deletion
    }

    let id: String
    var kind: Kind
    var text: String
}

struct DiffHunk: Identifiable, Codable, Sendable, Hashable {
    let id: String
    var header: String
    var lines: [DiffLine]
}

/// A single file's unified diff, scoped to one changed file in a project.
struct FileDiff: Identifiable, Codable, Sendable, Hashable {
    var id: String { path }
    var path: String
    var hunks: [DiffHunk]
}
