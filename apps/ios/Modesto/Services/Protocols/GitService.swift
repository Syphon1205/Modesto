import Foundation

protocol GitService: Sendable {
    func status(projectId: String) async throws -> GitStatusSummary
    func diff(projectId: String, path: String) async throws -> FileDiff
}
