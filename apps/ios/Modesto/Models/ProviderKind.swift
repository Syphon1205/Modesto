import Foundation

/// Coding agent providers Modesto can drive a session with. Mirrors
/// `ProviderKind` in packages/contracts/src/orchestration.ts.
enum ProviderKind: String, Codable, CaseIterable, Identifiable, Sendable {
    case codex
    case claudeAgent
    case cursor
    case gemini
    case grok
    case droid
    case kilo
    case opencode
    case pi

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .codex: "Codex"
        case .claudeAgent: "Claude Code"
        case .cursor: "Cursor"
        case .gemini: "Gemini"
        case .grok: "Grok"
        case .droid: "Factory Droid"
        case .kilo: "Kilo"
        case .opencode: "OpenCode"
        case .pi: "Pi"
        }
    }

    /// Asset catalog name of the provider's real mark, ported from the same
    /// brand SVGs `apps/web/src/components/Icons.tsx` uses.
    var logoAssetName: String {
        switch self {
        case .codex: "ProviderCodex"
        case .claudeAgent: "ProviderClaude"
        case .cursor: "ProviderCursor"
        case .gemini: "ProviderGemini"
        case .grok: "ProviderGrok"
        case .droid: "ProviderDroid"
        case .kilo: "ProviderKilo"
        case .opencode: "ProviderOpenCode"
        case .pi: "ProviderPi"
        }
    }

    /// Monochrome marks render as a template image tinted to match
    /// surrounding UI; marks with real brand color render as-is.
    var logoIsMonochrome: Bool {
        switch self {
        case .codex, .cursor, .grok, .droid, .kilo, .pi: true
        case .claudeAgent, .gemini, .opencode: false
        }
    }
}
