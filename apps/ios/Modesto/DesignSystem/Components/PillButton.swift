import SwiftUI

/// Primary call-to-action button style, used for "Start new task" and other
/// high-emphasis actions.
struct PillButtonStyle: ButtonStyle {
    var isProminent: Bool = true

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(ModestoFont.bodyMedium)
            .foregroundStyle(isProminent ? Color.white : ModestoColor.textPrimary)
            .padding(.horizontal, ModestoSpacing.lg)
            .padding(.vertical, ModestoSpacing.sm + 2)
            .background(
                isProminent ? ModestoColor.accent : ModestoColor.surfaceRaised,
                in: Capsule()
            )
            .overlay(
                Capsule().strokeBorder(isProminent ? .clear : ModestoColor.border, lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.8 : 1)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}

extension ButtonStyle where Self == PillButtonStyle {
    static var modestoPrimary: PillButtonStyle { PillButtonStyle(isProminent: true) }
    static var modestoSecondary: PillButtonStyle { PillButtonStyle(isProminent: false) }
}
