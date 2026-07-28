import SwiftUI
import UIKit

/// Cursor-inspired, minimal, technical design tokens — light and dark.
/// Every screen pulls colors, type, spacing, and radii from here instead of
/// hardcoding values, so both appearances and every future restyle stay
/// consistent across the app.
enum ModestoColor {
    static let background = Color(light: 0xF7F7F5, dark: 0x090A0D)
    static let surface = Color(light: 0xFFFFFF, dark: 0x12141A)
    static let surfaceRaised = Color(light: 0xF0F1F3, dark: 0x191C24)
    static let border = Color(light: 0xDFE1E6, dark: 0x292D37)
    static let borderSubtle = Color(light: 0xECEDEF, dark: 0x20232B)

    static let textPrimary = Color(light: 0x16161A, dark: 0xEDEDEF)
    static let textSecondary = Color(light: 0x63636B, dark: 0x9A9AA2)
    static let textTertiary = Color(light: 0x74747C, dark: 0x777780)

    static let accent = Color(light: 0x315FDB, dark: 0x78A6FF)
    static let accentMuted = Color(light: 0x315FDB, dark: 0x78A6FF).opacity(0.14)
    static let violet = Color(light: 0x7357D6, dark: 0xA58AF3)
    static let cyan = Color(light: 0x1785A2, dark: 0x58C7E5)

    static let success = Color(light: 0x1FA971, dark: 0x3DD68C)
    static let warning = Color(light: 0xB07C1E, dark: 0xE0A93E)
    static let danger = Color(light: 0xD93C41, dark: 0xE5484D)
    static let running = accent
    static let idle = textTertiary
}

enum ModestoFont {
    static let largeTitle = Font.system(.largeTitle, design: .default, weight: .semibold)
    static let title = Font.system(.title2, design: .default, weight: .semibold)
    static let headline = Font.system(.headline, design: .default, weight: .semibold)
    static let body = Font.system(.body, design: .default, weight: .regular)
    static let bodyMedium = Font.system(.body, design: .default, weight: .medium)
    static let subheadline = Font.system(.subheadline, design: .default, weight: .medium)
    static let footnote = Font.system(.footnote, design: .default, weight: .regular)
    static let caption = Font.system(.caption, design: .default, weight: .medium)
    static let mono = Font.system(.callout, design: .monospaced, weight: .regular)
    static let monoSmall = Font.system(.caption, design: .monospaced, weight: .regular)
}

enum ModestoSpacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 24
    static let xxl: CGFloat = 32
}

enum ModestoRadius {
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 20
    static let xxl: CGFloat = 28
    static let pill: CGFloat = 999
}

/// A single sizing scale for every icon/mark in the app (provider marks,
/// runtime chips, row glyphs, empty-state symbols) so nothing is sized ad
/// hoc per call site.
enum ModestoIconSize {
    static let xs: CGFloat = 14
    static let sm: CGFloat = 18
    static let md: CGFloat = 22
    static let lg: CGFloat = 28
    static let xl: CGFloat = 44
}

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }

    /// An appearance-adaptive color, resolved from the active trait
    /// collection so it responds to both system appearance and an explicit
    /// `preferredColorScheme` override.
    init(light: UInt32, dark: UInt32) {
        self.init(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark ? UIColor(Color(hex: dark)) : UIColor(Color(hex: light))
        })
    }
}
