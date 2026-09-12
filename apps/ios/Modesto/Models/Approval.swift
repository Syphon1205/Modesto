import Foundation

/// What kind of thing the agent is asking permission to do, mirroring
/// `ProviderRequestKind`.
enum ApprovalKind: String, Codable, Sendable {
    case command
    case fileRead
    case fileChange

    var label: String {
        switch self {
        case .command: "Run command"
        case .fileRead: "Read file"
        case .fileChange: "Change file"
        }
    }

    var symbolName: String {
        switch self {
        case .command: "terminal"
        case .fileRead: "doc.text.magnifyingglass"
        case .fileChange: "pencil"
        }
    }
}

/// Mirrors `ProviderApprovalDecision`.
enum ApprovalDecision: String, Codable, Sendable {
    case accept
    case acceptForSession
    case decline
    case cancel
}

/// A task waiting on the user before an agent session can continue.
struct Approval: Identifiable, Codable, Sendable, Hashable {
    let id: String
    var sessionId: String
    var projectId: String
    var kind: ApprovalKind
    var title: String
    var detail: String
    var requestedAt: Date
    var decision: ApprovalDecision?

    var isResolved: Bool { decision != nil }
}
