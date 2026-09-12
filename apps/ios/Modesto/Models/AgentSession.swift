import Foundation

/// Lifecycle state of an agent session, mirroring the union of
/// `OrchestrationSession.status` and `OrchestrationLatestTurn.state`.
enum AgentSessionStatus: String, Codable, Sendable {
    case running
    case waitingForApproval
    case waitingForInput
    case idle
    case completed
    case error
    case interrupted

    var label: String {
        switch self {
        case .running: "Running"
        case .waitingForApproval: "Needs approval"
        case .waitingForInput: "Needs input"
        case .idle: "Idle"
        case .completed: "Completed"
        case .error: "Error"
        case .interrupted: "Interrupted"
        }
    }

    var colorToken: ModestoColorToken {
        switch self {
        case .running: .running
        case .waitingForApproval, .waitingForInput: .warning
        case .idle, .completed: .idle
        case .error: .danger
        case .interrupted: .warning
        }
    }
}

/// Whether a session's test run (if any) is passing, so a session can be
/// scanned for health without opening a terminal.
enum SessionTestStatus: String, Codable, Sendable {
    case none, running, passed, failed
}

/// A structured snapshot of what an agent is actually doing — the mobile
/// alternative to reading raw terminal output to figure out progress.
/// Mirrors, at a coarser grain, the step/turn bookkeeping the desktop
/// orchestration layer already tracks server-side.
struct SessionProgress: Codable, Sendable, Hashable {
    var currentStep: String?
    var completedSteps: [String]
    var pendingSteps: [String]
    var changedFileCount: Int
    var testStatus: SessionTestStatus
    var testSummary: String?

    var totalStepCount: Int { completedSteps.count + pendingSteps.count + (currentStep == nil ? 0 : 1) }
}

/// A single conversation thread with a coding agent, scoped to a project.
struct AgentSession: Identifiable, Codable, Sendable, Hashable {
    let id: String
    var projectId: String
    var title: String
    var providerKind: ProviderKind
    var status: AgentSessionStatus
    var branch: String?
    var worktreePath: String?
    var lastMessagePreview: String?
    var progress: SessionProgress?
    var createdAt: Date
    var updatedAt: Date

    var hasPendingApproval: Bool { status == .waitingForApproval }
    var hasPendingUserInput: Bool { status == .waitingForInput }
}
