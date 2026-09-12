import Foundation

/// Everything that can land in the Approval Center: a permission an agent
/// is waiting on, or a question it asked. Unified so Inbox reads as one
/// prioritized list of "things waiting on you" instead of two disconnected
/// concepts.
enum InboxItem: Identifiable {
    case approval(Approval)
    case question(AgentSession)

    var id: String {
        switch self {
        case .approval(let approval): "approval-\(approval.id)"
        case .question(let session): "question-\(session.id)"
        }
    }

    var sessionId: String {
        switch self {
        case .approval(let approval): approval.sessionId
        case .question(let session): session.id
        }
    }

    var requestedAt: Date {
        switch self {
        case .approval(let approval): approval.requestedAt
        case .question(let session): session.updatedAt
        }
    }
}
