import SwiftUI

/// A single pill in a horizontal filter/segment strip — used by Activity's
/// category filter and Project detail's tab picker, so both look and
/// behave identically instead of each screen rolling its own toggle pill.
struct FilterChip: View {
    var title: String
    var count: Int? = nil
    var systemImage: String? = nil
    var isSelected: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                if let systemImage {
                    Image(systemName: systemImage)
                        .font(.caption.weight(.semibold))
                }
                Text(title)
                if let count, count > 0 {
                    Text("\(count)")
                        .opacity(0.7)
                }
            }
            .font(ModestoFont.subheadline)
            .foregroundStyle(isSelected ? Color.black : ModestoColor.textSecondary)
            .padding(.horizontal, ModestoSpacing.md)
            .padding(.vertical, ModestoSpacing.sm)
            .background(isSelected ? ModestoColor.accent : ModestoColor.surface, in: Capsule())
            .overlay(
                Capsule().strokeBorder(isSelected ? .clear : ModestoColor.borderSubtle, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}
