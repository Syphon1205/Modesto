import SwiftUI

/// The reusable card container for a single, self-contained panel (a
/// progress card, an action card). Prefer `GroupedCard` for a list of
/// related rows — this is for one card standing on its own.
struct SurfaceCard<Content: View>: View {
    var padding: CGFloat = ModestoSpacing.lg
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(padding)
            .background(ModestoColor.surface, in: RoundedRectangle(cornerRadius: ModestoRadius.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: ModestoRadius.lg, style: .continuous)
                    .strokeBorder(ModestoColor.borderSubtle, lineWidth: 1)
            )
    }
}

/// An inset-grouped card holding several related rows — the native iOS
/// pattern (Settings.app, Reminders) for "a handful of things that belong
/// together" instead of each row floating as its own separate bordered
/// card. Compose with `GroupedRow` and `GroupedDivider`.
struct GroupedCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: 0) { content }
            .background(ModestoColor.surface, in: RoundedRectangle(cornerRadius: ModestoRadius.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: ModestoRadius.lg, style: .continuous)
                    .strokeBorder(ModestoColor.borderSubtle, lineWidth: 1)
            )
    }
}

/// One row inside a `GroupedCard`. Handles the shared padding so rows line
/// up regardless of what's inside them.
struct GroupedRow<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(.horizontal, ModestoSpacing.lg)
            .padding(.vertical, ModestoSpacing.md)
    }
}

/// The hairline separator between `GroupedRow`s, inset to align with row
/// leading content rather than running edge to edge.
struct GroupedDivider: View {
    var body: some View {
        Divider()
            .overlay(ModestoColor.borderSubtle)
            .padding(.leading, ModestoSpacing.lg)
    }
}
