import SwiftUI

/// Modesto's vector "convergence mark" — ported stroke-for-stroke from
/// `apps/web/src/assets/modestoLogoPath.ts` (four strokes in a 100x100
/// space, 9.5pt round-capped weight) so the iOS app draws the exact same
/// mark as the desktop web app, crisp at any size and tintable like the
/// original `currentColor` SVG.
struct ModestoMark: View {
    var size: CGFloat = 32
    var color: Color = ModestoColor.textPrimary

    var body: some View {
        Canvas { context, canvasSize in
            let scale = canvasSize.width / 100
            context.stroke(
                Self.path(scale: scale),
                with: .color(color),
                style: StrokeStyle(lineWidth: 9.5 * scale, lineCap: .round, lineJoin: .round)
            )
        }
        .frame(width: size, height: size)
    }

    private static func path(scale: CGFloat) -> Path {
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x * scale, y: y * scale) }

        var path = Path()

        // M18 32 H39 C42 32 43.5 30.5 45 28 L55 12
        path.move(to: p(18, 32))
        path.addLine(to: p(39, 32))
        path.addCurve(to: p(45, 28), control1: p(42, 32), control2: p(43.5, 30.5))
        path.addLine(to: p(55, 12))

        // M66 20 L60 32 C58 36 59 39 62 42 L81 58
        path.move(to: p(66, 20))
        path.addLine(to: p(60, 32))
        path.addCurve(to: p(62, 42), control1: p(58, 36), control2: p(59, 39))
        path.addLine(to: p(81, 58))

        // M14 45 L35 51 C39 52 41 55 41 59 V80
        path.move(to: p(14, 45))
        path.addLine(to: p(35, 51))
        path.addCurve(to: p(41, 59), control1: p(39, 52), control2: p(41, 55))
        path.addLine(to: p(41, 80))

        // M57 58 L70 70
        path.move(to: p(57, 58))
        path.addLine(to: p(70, 70))

        return path
    }
}

#Preview {
    ZStack {
        ModestoColor.background
        ModestoMark(size: 64)
    }
    .frame(width: 160, height: 160)
}
