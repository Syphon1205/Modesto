import SwiftUI

/// A native action card for a session that's blocked waiting on an answer
/// — an inline reply field right on the card, so answering a question
/// doesn't require leaving Inbox for the session's own composer.
struct QuestionActionCard: View {
    var session: AgentSession
    var isResolving: Bool
    var onAnswer: (String) -> Void
    var onOpenSession: (() -> Void)? = nil

    @State private var draft = ""
    @FocusState private var isFocused: Bool
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: ModestoSpacing.md) {
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: ModestoSpacing.md) {
                        HStack(alignment: .top) {
                            ProviderAvatar(provider: session.providerKind, size: 42)
                            Spacer(minLength: 0)
                            openSessionButton
                        }
                        questionCopy
                    }
                } else {
                    HStack(alignment: .top, spacing: ModestoSpacing.md) {
                        ProviderAvatar(provider: session.providerKind, size: 42)
                        questionCopy
                        Spacer(minLength: 0)
                        openSessionButton
                    }
                }

                HStack(spacing: ModestoSpacing.sm) {
                    TextField("Type your answer…", text: $draft, axis: .vertical)
                        .font(ModestoFont.body)
                        .foregroundStyle(ModestoColor.textPrimary)
                        .lineLimit(1...3)
                        .focused($isFocused)
                        .padding(.leading, ModestoSpacing.sm)
                        .padding(.vertical, ModestoSpacing.sm)
                        .submitLabel(.send)
                        .onSubmit { submitAnswer() }

                    Button {
                        submitAnswer()
                    } label: {
                        Image(systemName: "arrow.up")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 34, height: 34)
                            .background(session.providerKind.brandColor, in: Circle())
                    }
                    .disabled(isResolving || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .opacity(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.32 : 1)
                }
                .padding(5)
                .background(ModestoColor.surfaceRaised, in: RoundedRectangle(cornerRadius: ModestoRadius.lg, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: ModestoRadius.lg, style: .continuous)
                        .strokeBorder(ModestoColor.borderSubtle, lineWidth: 0.75)
                }
            }
        }
    }

    private var questionCopy: some View {
        VStack(alignment: .leading, spacing: ModestoSpacing.xs) {
            HStack(spacing: ModestoSpacing.xs) {
                Image(systemName: "questionmark.bubble.fill")
                Text("QUESTION")
                    .kerning(0.6)
                Text("·")
                CompactRelativeTime(date: session.updatedAt)
            }
            .font(ModestoFont.caption)
            .foregroundStyle(session.providerKind.brandColor)

            Text(session.title)
                .font(ModestoFont.bodyMedium)
                .foregroundStyle(ModestoColor.textPrimary)
            if let question = session.progress?.currentStep ?? session.lastMessagePreview {
                Text(question)
                    .font(ModestoFont.footnote)
                    .foregroundStyle(ModestoColor.textSecondary)
                    .lineLimit(dynamicTypeSize.isAccessibilitySize ? 4 : 2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var openSessionButton: some View {
        if let onOpenSession {
            Button(action: onOpenSession) {
                Image(systemName: "arrow.up.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(ModestoColor.textSecondary)
                    .frame(width: 32, height: 32)
                    .background(ModestoColor.surfaceRaised, in: Circle())
            }
            .accessibilityLabel("Open session")
        }
    }

    private func submitAnswer() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isResolving else { return }
        draft = ""
        isFocused = false
        onAnswer(text)
    }
}
