import SwiftUI

/// The message composer pinned to the bottom of a chat-like screen —
/// shared by Session detail's reply composer and New Chat's first-message
/// composer so both feel identical instead of each screen rolling its own.
struct ChatComposer: View {
    var placeholder: String
    @Binding var text: String
    var isSending: Bool
    var focus: FocusState<Bool>.Binding
    var onSend: () -> Void

    private var isEmpty: Bool {
        text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        HStack(alignment: .bottom, spacing: ModestoSpacing.sm) {
            TextField(placeholder, text: $text, axis: .vertical)
                .font(ModestoFont.body)
                .foregroundStyle(ModestoColor.textPrimary)
                .lineLimit(1...4)
                .focused(focus)
                .submitLabel(.send)
                .onSubmit {
                    if !isEmpty && !isSending { onSend() }
                }
                .padding(.leading, ModestoSpacing.sm)
                .padding(.vertical, ModestoSpacing.sm)

            Button(action: onSend) {
                Group {
                    if isSending {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Image(systemName: "arrow.up")
                            .font(.system(size: 16, weight: .bold))
                    }
                }
                .foregroundStyle(.white)
                .frame(width: 38, height: 38)
                .background(ModestoColor.accent, in: Circle())
            }
            .disabled(isSending || isEmpty)
            .opacity(isEmpty ? 0.34 : 1)
        }
        .padding(6)
        .background(ModestoColor.surface.opacity(0.96), in: RoundedRectangle(cornerRadius: ModestoRadius.xl, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: ModestoRadius.xl, style: .continuous)
                .strokeBorder(ModestoColor.border.opacity(focus.wrappedValue ? 1 : 0.65), lineWidth: focus.wrappedValue ? 1.25 : 0.75)
        }
        .padding(.horizontal, ModestoSpacing.md)
        .padding(.vertical, ModestoSpacing.sm)
        .background(ModestoColor.background.opacity(0.98))
        .overlay(alignment: .top) {
            Divider().overlay(ModestoColor.borderSubtle.opacity(0.7))
        }
        .animation(.easeOut(duration: 0.16), value: focus.wrappedValue)
        .animation(.easeOut(duration: 0.16), value: isEmpty)
    }
}
