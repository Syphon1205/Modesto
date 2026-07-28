import Foundation

protocol ProjectService: Sendable {
    func allProjects() async throws -> [Project]
    func recentProjects(limit: Int) async throws -> [Project]
    func project(id: String) async throws -> Project
}
