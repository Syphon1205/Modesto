import SwiftUI

/// Shown wherever a list can legitimately be empty — inbox with nothing
/// pending, activity with no events yet, and so on.
struct EmptyStateView: View {
    var symbolName: String
    var title: String
    var subtitle: String

    var body: some View {
        VStack(spacing: ModestoSpacing.sm) {
            Image(systemName: symbolName)
                .font(.system(size: 28, weight: .light))
                .foregroundStyle(ModestoColor.textTertiary)
            Text(title)
                .font(ModestoFont.bodyMedium)
                .foregroundStyle(ModestoColor.textPrimary)
            Text(subtitle)
                .font(ModestoFont.footnote)
                .foregroundStyle(ModestoColor.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, ModestoSpacing.xxl)
        .padding(.horizontal, ModestoSpacing.lg)
    }
}
