import Foundation

/// Filter buckets for the operations timeline. Every entry gets exactly one
/// category, even though in principle an event could match more than one
/// (a git action in a running session, say) — one clear bucket per entry
/// keeps the filter predictable instead of entries appearing in several
/// tabs at once.
enum ActivityCategory: String, CaseIterable, Identifiable {
    case running, completed, failed, deployments, reviews

    var id: String { rawValue }

    var label: String {
        switch self {
        case .running: "Running"
        case .completed: "Completed"
        case .failed: "Failed"
        case .deployments: "Deployments"
        case .reviews: "Reviews"
        }
    }

    var symbolName: String {
        switch self {
        case .running: "bolt.fill"
        case .completed: "checkmark.circle"
        case .failed: "exclamationmark.triangle"
        case .deployments: "arrow.up.forward.app"
        case .reviews: "hand.raised"
        }
    }
}

/// One row in the operations timeline — a session event or a deployment,
/// normalized to the same shape so they can share one sorted, filterable
/// feed instead of two disconnected lists.
struct ActivityEntry: Identifiable {
    var id: String
    var category: ActivityCategory
    var contextTitle: String
    var summary: String
    var detail: String?
    var symbolName: String
    var colorToken: ModestoColorToken
    var timestamp: Date
    var sessionId: String?
    var projectId: String
    var providerKind: ProviderKind?
}
