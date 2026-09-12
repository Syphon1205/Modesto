import SwiftUI

/// The small tinted rounded-square icon every list row's leading glyph
/// uses (project folder, approval kind, changed-file kind). One definition
/// keeps the box size, corner radius, tint opacity, and icon size pixel-
/// identical across rows instead of each row re-deriving them.
struct RowIconBadge: View {
    var systemImage: String
    var tint: Color

    var body: some View {
        RoundedRectangle(cornerRadius: ModestoRadius.sm, style: .continuous)
            .fill(
                LinearGradient(
                    colors: [tint.opacity(0.24), tint.opacity(0.09)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .frame(width: 38, height: 38)
            .overlay(
                Image(systemName: systemImage)
                    .font(.system(size: ModestoIconSize.xs, weight: .semibold))
                    .foregroundStyle(tint)
            )
            .overlay {
                RoundedRectangle(cornerRadius: ModestoRadius.sm, style: .continuous)
                    .strokeBorder(tint.opacity(0.2), lineWidth: 0.75)
            }
            .shadow(color: tint.opacity(0.12), radius: 5, y: 3)
    }
}
