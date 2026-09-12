import Foundation

protocol ApprovalService: Sendable {
    func pendingApprovals() async throws -> [Approval]
    func resolve(approvalId: String, decision: ApprovalDecision) async throws
}
