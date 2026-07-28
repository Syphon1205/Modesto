import Foundation

/// The kind of thing that happened in a session's timeline.
enum SessionEventKind: String, Codable, Sendable {
    case userMessage
    case assistantMessage
    case toolCall
    case fileChange
    case gitAction
    case approvalRequested
    case approvalResolved
    case statusChanged
    case error

    var symbolName: String {
        switch self {
        case .userMessage: "person.fill"
        case .assistantMessage: "sparkle"
        case .toolCall: "wrench.and.screwdriver"
        case .fileChange: "doc.text"
        case .gitAction: "arrow.triangle.branch"
        case .approvalRequested: "hand.raised"
        case .approvalResolved: "checkmark.circle"
        case .statusChanged: "arrow.triangle.2.circlepath"
        case .error: "exclamationmark.triangle"
        }
    }
}

/// One entry in an agent session's activity timeline.
struct SessionEvent: Identifiable, Codable, Sendable, Hashable {
    let id: String
    var sessionId: String
    var projectId: String
    var kind: SessionEventKind
    var summary: String
    var detail: String?
    var createdAt: Date
}
