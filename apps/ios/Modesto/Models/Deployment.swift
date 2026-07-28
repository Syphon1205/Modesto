import Foundation

enum DeploymentProviderKind: String, Codable, Sendable {
    case vercel
    case other
}

enum DeploymentStatus: String, Codable, Sendable {
    case building
    case ready
    case error
    case canceled

    var label: String {
        switch self {
        case .building: "Building"
        case .ready: "Ready"
        case .error: "Error"
        case .canceled: "Canceled"
        }
    }

    var colorToken: ModestoColorToken {
        switch self {
        case .building: .warning
        case .ready: .success
        case .error: .danger
        case .canceled: .idle
        }
    }
}

/// A preview or production deployment associated with a project, e.g. Vercel.
struct Deployment: Identifiable, Codable, Sendable, Hashable {
    let id: String
    var projectId: String
    var provider: DeploymentProviderKind
    var environment: String
    var status: DeploymentStatus
    var url: String?
    var commitMessage: String?
    var createdAt: Date
}
