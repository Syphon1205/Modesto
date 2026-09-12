import Foundation

protocol TerminalService: Sendable {
    /// `nil` when no terminal has been started for this session yet.
    func terminal(sessionId: String) async throws -> TerminalStream?
    func startTerminal(sessionId: String, cwd: String) async throws -> TerminalStream
    func outputStream(sessionId: String) -> AsyncStream<TerminalLine>
    func write(sessionId: String, input: String) async throws
}
