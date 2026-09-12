import SwiftUI

/// A date-grouped operations timeline across every project. Related events
/// share one surface, so the screen reads like a feed instead of a wall of
/// independent cards.
struct ActivityView: View {
    @StateObject private var viewModel: ActivityViewModel
    @Binding private var path: NavigationPath

    init(environment: AppEnvironment, path: Binding<NavigationPath>) {
        _viewModel = StateObject(wrappedValue: ActivityViewModel(environment: environment))
        _path = path
    }

    var body: some View {
        ZStack {
            AppBackdrop(accent: ModestoColor.violet)
            ScrollView {
                VStack(spacing: 0) {
                filterBar

                if viewModel.filteredEntries.isEmpty && !viewModel.isLoading {
                    EmptyStateView(
                        symbolName: "waveform.path.ecg",
                        title: viewModel.selectedCategory == nil ? "No activity yet" : "Nothing here",
                        subtitle: viewModel.selectedCategory == nil
                            ? "Agent work, reviews, and deployments will appear here."
                            : "No \(viewModel.selectedCategory?.label.lowercased() ?? "") activity right now."
                    )
                    .padding(.top, ModestoSpacing.xxl)
                } else {
                    LazyVStack(alignment: .leading, spacing: ModestoSpacing.xl) {
                        ForEach(dayGroups) { group in
                            VStack(alignment: .leading, spacing: ModestoSpacing.sm) {
                                HStack {
                                    Text(group.title)
                                        .font(ModestoFont.headline)
                                        .foregroundStyle(ModestoColor.textPrimary)
                                    Spacer()
                                    Text("\(group.entries.count)")
                                        .font(ModestoFont.caption)
                                        .foregroundStyle(ModestoColor.textTertiary)
                                }

                                GroupedCard {
                                    ForEach(Array(group.entries.enumerated()), id: \.element.id) { index, entry in
                                        Button {
                                            open(entry)
                                        } label: {
                                            ActivityEntryRow(entry: entry)
                                        }
                                        .buttonStyle(.plain)

                                        if index < group.entries.count - 1 {
                                            GroupedDivider()
                                        }
                                    }
                                }
                            }
                        }
                    }
                    .padding(.horizontal, ModestoSpacing.lg)
                    .padding(.top, ModestoSpacing.sm)
                    .padding(.bottom, ModestoSpacing.xxl)
                }
                }
            }
        }
        .refreshable { await viewModel.load() }
        .navigationTitle("Activity")
        .navigationBarTitleDisplayMode(.large)
        .task { await viewModel.load() }
    }

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: ModestoSpacing.sm) {
                FilterChip(
                    title: "All",
                    systemImage: "line.3.horizontal.decrease.circle",
                    isSelected: viewModel.selectedCategory == nil
                ) {
                    viewModel.selectedCategory = nil
                }
                ForEach(ActivityCategory.allCases) { category in
                    FilterChip(
                        title: category.label,
                        count: viewModel.count(for: category),
                        systemImage: category.symbolName,
                        isSelected: viewModel.selectedCategory == category
                    ) {
                        viewModel.selectedCategory = viewModel.selectedCategory == category ? nil : category
                    }
                }
            }
            .padding(.horizontal, ModestoSpacing.lg)
            .padding(.vertical, ModestoSpacing.sm)
        }
        .fadingHorizontalEdges()
        .overlay(alignment: .bottom) {
            Divider().overlay(ModestoColor.borderSubtle.opacity(0.65))
        }
    }

    private var dayGroups: [ActivityDayGroup] {
        let calendar = Calendar.current
        let grouped = Dictionary(grouping: viewModel.filteredEntries) {
            calendar.startOfDay(for: $0.timestamp)
        }

        return grouped.keys.sorted(by: >).map { day in
            let title: String
            if calendar.isDateInToday(day) {
                title = "Today"
            } else if calendar.isDateInYesterday(day) {
                title = "Yesterday"
            } else {
                title = day.formatted(.dateTime.weekday(.wide).month(.abbreviated).day())
            }
            return ActivityDayGroup(day: day, title: title, entries: grouped[day] ?? [])
        }
    }

    private func open(_ entry: ActivityEntry) {
        if let sessionId = entry.sessionId {
            path.append(AppRoute.session(id: sessionId))
        } else {
            path.append(AppRoute.project(id: entry.projectId))
        }
    }
}

private struct ActivityDayGroup: Identifiable {
    var day: Date
    var title: String
    var entries: [ActivityEntry]
    var id: Date { day }
}

private struct ActivityEntryRow: View {
    var entry: ActivityEntry
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        GroupedRow {
            if dynamicTypeSize.isAccessibilitySize {
                accessibilityLayout
            } else {
                standardLayout
            }
        }
        .contentShape(Rectangle())
    }

    private var standardLayout: some View {
        HStack(alignment: .top, spacing: ModestoSpacing.md) {
            activityGlyph
            entryCopy
            Spacer(minLength: ModestoSpacing.sm)
            VStack(alignment: .trailing, spacing: ModestoSpacing.sm) {
                timestamp
                Image(systemName: "chevron.right")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(ModestoColor.textTertiary)
            }
        }
    }

    private var accessibilityLayout: some View {
        VStack(alignment: .leading, spacing: ModestoSpacing.md) {
            HStack(alignment: .top, spacing: ModestoSpacing.md) {
                activityGlyph
                VStack(alignment: .leading, spacing: 2) {
                    Text(entry.contextTitle)
                        .font(ModestoFont.caption)
                        .foregroundStyle(contextColor)
                        .lineLimit(2)
                    timestamp
                }
                Spacer(minLength: 0)
            }

            Text(entry.summary)
                .font(ModestoFont.body)
                .foregroundStyle(ModestoColor.textPrimary)
                .lineLimit(4)

            if let detail = entry.detail {
                Text(detail)
                    .font(ModestoFont.monoSmall)
                    .foregroundStyle(ModestoColor.textSecondary)
                    .lineLimit(3)
            }
        }
    }

    private var entryCopy: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(entry.contextTitle)
                .font(ModestoFont.caption)
                .foregroundStyle(contextColor)
                .lineLimit(1)
            Text(entry.summary)
                .font(ModestoFont.body)
                .foregroundStyle(ModestoColor.textPrimary)
                .lineLimit(2)
            if let detail = entry.detail {
                Text(detail)
                    .font(ModestoFont.monoSmall)
                    .foregroundStyle(ModestoColor.textSecondary)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var activityGlyph: some View {
        if let provider = entry.providerKind {
            ProviderAvatar(provider: provider, size: 38)
                .overlay(alignment: .bottomTrailing) {
                    EventKindBadge(symbolName: entry.symbolName, tint: entry.colorToken.color)
                        .offset(x: 4, y: 4)
                }
        } else {
            RowIconBadge(systemImage: entry.symbolName, tint: entry.colorToken.color)
        }
    }

    private var contextColor: Color {
        entry.providerKind?.brandColor ?? entry.colorToken.color
    }

    private var timestamp: some View {
        CompactRelativeTime(date: entry.timestamp)
            .font(ModestoFont.caption)
            .foregroundStyle(ModestoColor.textTertiary)
    }
}

private struct EventKindBadge: View {
    var symbolName: String
    var tint: Color

    var body: some View {
        Image(systemName: symbolName)
            .font(.system(size: 8, weight: .bold))
            .foregroundStyle(tint)
            .frame(width: 17, height: 17)
            .background(ModestoColor.surface, in: RoundedRectangle(cornerRadius: 5, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 5, style: .continuous)
                    .strokeBorder(tint.opacity(0.28), lineWidth: 0.75)
            }
    }
}

#Preview {
    NavigationStack {
        ActivityView(environment: .mock, path: .constant(NavigationPath()))
    }
    .preferredColorScheme(.dark)
}
