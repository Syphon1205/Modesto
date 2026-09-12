import Foundation

enum RuntimeConnectionStatus: String, Codable, Sendable {
    case connected
    case connecting
    case disconnected
    case error

    var color: ModestoColorToken {
        switch self {
        case .connected: .success
        case .connecting: .warning
        case .disconnected: .idle
        case .error: .danger
        }
    }

    var label: String {
        switch self {
        case .connected: "Connected"
        case .connecting: "Connecting"
        case .disconnected: "Disconnected"
        case .error: "Error"
        }
    }
}

/// A semantic color reference that maps onto `ModestoColor` without pulling
/// SwiftUI into every model file.
enum ModestoColorToken: Sendable {
    case success, warning, danger, running, idle, accent
}

/// A physical or virtual machine Modesto can reach — the local Mac running
/// Modesto Desktop, or a remote box over SSH. Agent providers run *on* a
/// host; a host is the primary grouping unit on Home ("Connected Machines"),
/// not the individual providers.
enum RuntimeHostKind: String, Codable, Sendable {
    case local
    case remote

    var symbolName: String {
        switch self {
        case .local: "laptopcomputer"
        case .remote: "server.rack"
        }
    }
}

struct RuntimeHost: Identifiable, Codable, Sendable, Hashable {
    let id: String
    var name: String
    var kind: RuntimeHostKind
    var detail: String?
    var status: RuntimeConnectionStatus
    var lastSeenAt: Date?
}

/// The kind of thing a `RuntimeConnection` represents once machines are
/// factored out into `RuntimeHost`: an agent provider running on some host,
/// or a cloud integration with no machine of its own.
enum RuntimeConnectionKind: String, Codable, CaseIterable, Sendable {
    case agentProvider
    case gitHub
    case vercel

    var displayName: String {
        switch self {
        case .agentProvider: "Agent Provider"
        case .gitHub: "GitHub"
        case .vercel: "Vercel"
        }
    }

    var symbolName: String {
        switch self {
        case .agentProvider: "cpu"
        case .gitHub: "chevron.left.slash.chevron.right"
        case .vercel: "triangle"
        }
    }

    /// Asset catalog name of a real brand mark, when one exists. Falls back
    /// to `symbolName` otherwise.
    var logoAssetName: String? {
        switch self {
        case .gitHub: "RuntimeGitHub"
        case .agentProvider, .vercel: nil
        }
    }
}

/// An agent provider or cloud integration Modesto is connected to. Agent
/// providers carry `hostId`, pointing at the `RuntimeHost` they run on;
/// cloud integrations (GitHub, Vercel) have no host of their own.
struct RuntimeConnection: Identifiable, Codable, Sendable, Hashable {
    let id: String
    var kind: RuntimeConnectionKind
    var providerKind: ProviderKind?
    var hostId: String?
    var name: String
    var detail: String?
    var status: RuntimeConnectionStatus
    var lastSeenAt: Date?
}
