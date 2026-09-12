import Foundation

protocol DeploymentService: Sendable {
    func deployments(projectId: String) async throws -> [Deployment]
}
