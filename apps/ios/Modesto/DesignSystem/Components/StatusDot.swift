import SwiftUI

extension ModestoColorToken {
    var color: Color {
        switch self {
        case .success: ModestoColor.success
        case .warning: ModestoColor.warning
        case .danger: ModestoColor.danger
        case .running: ModestoColor.running
        case .idle: ModestoColor.idle
        case .accent: ModestoColor.accent
        }
    }
}

/// A small status indicator dot, optionally paired with a label. Used for
/// runtime connection status, session status, and deployment status.
struct StatusDot: View {
    var token: ModestoColorToken
    var label: String? = nil
    var pulse: Bool = false

    @State private var isPulsing = false

    var body: some View {
        HStack(spacing: ModestoSpacing.xs) {
            Circle()
                .fill(token.color)
                .frame(width: 6, height: 6)
                .opacity(pulse && isPulsing ? 0.4 : 1)
                .animation(
                    pulse ? .easeInOut(duration: 0.9).repeatForever(autoreverses: true) : .default,
                    value: isPulsing
                )
                .onAppear { if pulse { isPulsing = true } }
            if let label {
                Text(label)
                    .font(ModestoFont.caption)
                    .foregroundStyle(ModestoColor.textSecondary)
            }
        }
    }
}
