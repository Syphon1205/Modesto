import Foundation

struct GitBranchSummary: Codable, Sendable, Hashable {
    var name: String
    var isDefault: Bool
    var upstream: String?
    var ahead: Int
    var behind: Int
}

struct GitPullRequestSummary: Identifiable, Codable, Sendable, Hashable {
    var id: Int
    var title: String
    var url: String
    var state: String
    var isDraft: Bool
    var checksPassing: Bool?
}

/// Mirrors the shape of `GitStatusResult`, condensed for a mobile summary
/// card rather than a full desktop diff surface.
struct GitStatusSummary: Codable, Sendable, Hashable {
    var branch: GitBranchSummary?
    var hasUncommittedChanges: Bool
    var changedFiles: [ChangedFile]
    var pullRequest: GitPullRequestSummary?
}
