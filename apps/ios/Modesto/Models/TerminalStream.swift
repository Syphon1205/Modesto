import Foundation

/// Mirrors `TerminalSessionStatus`.
enum TerminalSessionStatus: String, Codable, Sendable {
    case starting
    case running
    case exited
    case error
}

/// One line of terminal output or input, kept structured instead of a raw
/// ANSI blob so the UI can style commands and output differently.
struct TerminalLine: Identifiable, Codable, Sendable, Hashable {
    let id: String
    var text: String
    var isCommand: Bool
    var timestamp: Date
}

/// A live or replayed terminal attached to a project or agent session.
struct TerminalStream: Identifiable, Codable, Sendable, Hashable {
    let id: String
    var sessionId: String
    var cwd: String
    var status: TerminalSessionStatus
    var lines: [TerminalLine]
}
