import Foundation

/// A workspace Modesto manages — one Git repo (or worktree root) with agent
/// sessions, terminals, and previews attached to it.
struct Project: Identifiable, Codable, Sendable, Hashable {
    let id: String
    var name: String
    var workspacePath: String
    var hostId: String
    var defaultBranch: String?
    var isPinned: Bool
    var activeSessionCount: Int
    var pendingApprovalCount: Int
    var lastActivityAt: Date
}
