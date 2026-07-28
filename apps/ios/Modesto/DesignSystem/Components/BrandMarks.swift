import SwiftUI

/// A provider's real brand mark (ported from the same SVGs
/// `apps/web/src/components/Icons.tsx` ships), sized and tinted
/// consistently everywhere a provider needs an icon.
struct ProviderMark: View {
    var provider: ProviderKind
    var size: CGFloat = 14
    var tint: Color? = nil

    var body: some View {
        Image(provider.logoAssetName)
            .resizable()
            .renderingMode(provider.logoIsMonochrome || tint != nil ? .template : .original)
            .aspectRatio(contentMode: .fit)
            .frame(width: size, height: size)
            .foregroundStyle(tint ?? ModestoColor.textSecondary)
    }
}

/// A quiet provider identity mark. Color is reserved for the logo itself;
/// the container stays neutral so provider branding never dominates content.
struct ProviderAvatar: View {
    var provider: ProviderKind
    var size: CGFloat = 38

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.31, style: .continuous)
                .fill(ModestoColor.surfaceRaised)

            ProviderMark(provider: provider, size: size * 0.46, tint: provider.brandColor)
        }
        .frame(width: size, height: size)
        .overlay {
            RoundedRectangle(cornerRadius: size * 0.31, style: .continuous)
                .strokeBorder(ModestoColor.border, lineWidth: 0.75)
        }
        .accessibilityHidden(true)
    }
}

extension ProviderKind {
    var brandColor: Color {
        switch self {
        case .codex: Color(hex: 0x10A37F)
        case .claudeAgent: Color(hex: 0xD97757)
        case .cursor: Color(hex: 0x6269E8)
        case .gemini: Color(hex: 0x4B8BF5)
        case .grok: Color(hex: 0x73737D)
        case .droid: Color(hex: 0x33A06F)
        case .kilo: Color(hex: 0x8B5CF6)
        case .opencode: Color(hex: 0x168AAD)
        case .pi: Color(hex: 0xC58A21)
        }
    }
}

/// A runtime connection's icon: the linked provider's real mark when one is
/// set, a real brand mark for the connection kind itself when one exists
/// (GitHub), or an SF Symbol fallback otherwise (Vercel's mark already is a
/// plain triangle).
struct RuntimeMark: View {
    var connection: RuntimeConnection
    var size: CGFloat = 14

    var body: some View {
        if let provider = connection.providerKind {
            ProviderMark(provider: provider, size: size)
        } else if let assetName = connection.kind.logoAssetName {
            Image(assetName)
                .resizable()
                .renderingMode(.template)
                .aspectRatio(contentMode: .fit)
                .frame(width: size, height: size)
                .foregroundStyle(ModestoColor.textSecondary)
        } else {
            Image(systemName: connection.kind.symbolName)
                .font(.system(size: size * 0.85, weight: .medium))
                .foregroundStyle(ModestoColor.textSecondary)
                .frame(width: size, height: size)
        }
    }
}

/// A host machine's icon — laptop for the local Mac, a rack for a remote box.
struct HostMark: View {
    var host: RuntimeHost
    var size: CGFloat = 14

    var body: some View {
        Image(systemName: host.kind.symbolName)
            .font(.system(size: size * 0.85, weight: .medium))
            .foregroundStyle(ModestoColor.textSecondary)
            .frame(width: size, height: size)
    }
}
