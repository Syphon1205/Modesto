import SwiftUI

/// The small circled glyph representing a `SessionEventKind`, shared by the
/// session timeline and the cross-project Activity feed so both render
/// identically instead of each re-deriving the same circle+icon.
struct EventKindIcon: View {
    var kind: SessionEventKind
    var diameter: CGFloat = 28

    var body: some View {
        Image(systemName: kind.symbolName)
            .font(.system(size: diameter * 0.43, weight: .semibold))
            .foregroundStyle(kind.tint)
            .frame(width: diameter, height: diameter)
            .background(
                LinearGradient(
                    colors: [kind.tint.opacity(0.2), kind.tint.opacity(0.08)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ),
                in: RoundedRectangle(cornerRadius: diameter * 0.32, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: diameter * 0.32, style: .continuous)
                    .strokeBorder(kind.tint.opacity(0.18), lineWidth: 0.75)
            }
    }
}

private extension SessionEventKind {
    var tint: Color {
        switch self {
        case .userMessage: ModestoColor.accent
        case .assistantMessage: ModestoColor.success
        case .toolCall: Color(hex: 0x9B7BD7)
        case .fileChange: Color(hex: 0x4C9ED9)
        case .gitAction: Color(hex: 0xE18A45)
        case .approvalRequested: ModestoColor.warning
        case .approvalResolved: ModestoColor.success
        case .statusChanged: ModestoColor.accent
        case .error: ModestoColor.danger
        }
    }
}
