import SwiftUI

/// Shared neutral background. Product surfaces carry the hierarchy; the
/// backdrop intentionally stays quiet.
struct AppBackdrop: View {
    var accent: Color = ModestoColor.accent

    var body: some View {
        ModestoColor.background
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

struct GlassSurface<Content: View>: View {
    var cornerRadius: CGFloat = ModestoRadius.xl
    var padding: CGFloat = ModestoSpacing.lg
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(padding)
            .background(ModestoColor.surface, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(ModestoColor.borderSubtle, lineWidth: 0.75)
            }
    }
}
