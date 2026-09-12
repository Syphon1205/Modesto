import SwiftUI

/// A provider's real mark plus its name, kept small and unobtrusive so
/// branding stays subordinate to the content around it.
struct ProviderBadge: View {
    var provider: ProviderKind
    var showsName: Bool = true

    var body: some View {
        HStack(spacing: ModestoSpacing.xs) {
            ProviderMark(provider: provider, size: ModestoIconSize.xs, tint: provider.brandColor)
            if showsName {
                Text(provider.displayName)
                    .font(ModestoFont.caption)
                    .foregroundStyle(ModestoColor.textPrimary)
            }
        }
        .padding(.horizontal, ModestoSpacing.sm)
        .padding(.vertical, 4)
        .background(provider.brandColor.opacity(0.1), in: Capsule())
        .overlay(Capsule().strokeBorder(provider.brandColor.opacity(0.16), lineWidth: 0.75))
    }
}
