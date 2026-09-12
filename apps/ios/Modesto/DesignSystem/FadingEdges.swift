import SwiftUI

private struct FadingHorizontalEdges: ViewModifier {
    var width: CGFloat = 20

    func body(content: Content) -> some View {
        content.mask(
            GeometryReader { proxy in
                let fadeFraction = min(0.5, width / max(proxy.size.width, 1))
                LinearGradient(
                    stops: [
                        .init(color: .black, location: 0),
                        .init(color: .black, location: 1 - fadeFraction),
                        .init(color: .clear, location: 1),
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            }
        )
    }
}

extension View {
    /// Fades the trailing edge of a horizontally-scrolling row so a
    /// partially visible next item reads as an intentional "more to
    /// scroll" affordance instead of a clipped layout.
    func fadingHorizontalEdges(width: CGFloat = 20) -> some View {
        modifier(FadingHorizontalEdges(width: width))
    }
}
