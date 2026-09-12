import Foundation

/// Hand-authored fixtures for every model, wired together so Home, Project,
/// Inbox, and Activity all tell one coherent story. Production networking
/// (WebSocket RPC against the Modesto server, matching
/// `packages/contracts/src/ws.ts`) will replace `Mock*Service`, not this
/// file directly — this file only feeds the mocks.
enum MockData {
    private static func minutesAgo(_ minutes: Double) -> Date {
        Date().addingTimeInterval(-minutes * 60)
    }

    private static func hoursAgo(_ hours: Double) -> Date {
        minutesAgo(hours * 60)
    }

    // MARK: Runtime hosts

    static let runtimeHosts: [RuntimeHost] = [
        RuntimeHost(
            id: "host-macbook",
            name: "MacBook Pro",
            kind: .local,
            detail: "Modesto Desktop v0.1.2",
            status: .connected,
            lastSeenAt: minutesAgo(1)
        ),
        RuntimeHost(
            id: "host-buildbox",
            name: "build-box",
            kind: .remote,
            detail: "ubuntu@10.0.1.42",
            status: .connected,
            lastSeenAt: hoursAgo(1)
        ),
    ]

    // MARK: Runtime connections

    static let runtimeConnections: [RuntimeConnection] = [
        RuntimeConnection(
            id: "rt-claude",
            kind: .agentProvider,
            providerKind: .claudeAgent,
            hostId: "host-macbook",
            name: "Claude Code",
            detail: "CLI · 2.1.0",
            status: .connected,
            lastSeenAt: minutesAgo(1)
        ),
        RuntimeConnection(
            id: "rt-codex",
            kind: .agentProvider,
            providerKind: .codex,
            hostId: "host-macbook",
            name: "Codex",
            detail: "app-server",
            status: .connected,
            lastSeenAt: minutesAgo(3)
        ),
        RuntimeConnection(
            id: "rt-github",
            kind: .gitHub,
            providerKind: nil,
            hostId: nil,
            name: "GitHub",
            detail: "Syphon1205/Modesto",
            status: .connected,
            lastSeenAt: hoursAgo(2)
        ),
        RuntimeConnection(
            id: "rt-vercel",
            kind: .vercel,
            providerKind: nil,
            hostId: nil,
            name: "Vercel",
            detail: "Not linked",
            status: .disconnected,
            lastSeenAt: nil
        ),
    ]

    // MARK: Projects

    static let projects: [Project] = [
        Project(
            id: "proj-modesto",
            name: "Modesto",
            workspacePath: "~/dev/modesto",
            hostId: "host-macbook",
            defaultBranch: "main",
            isPinned: true,
            activeSessionCount: 3,
            pendingApprovalCount: 2,
            lastActivityAt: minutesAgo(1)
        ),
        Project(
            id: "proj-marketing",
            name: "Modesto Marketing",
            workspacePath: "~/dev/modesto-marketing",
            hostId: "host-macbook",
            defaultBranch: "main",
            isPinned: false,
            activeSessionCount: 1,
            pendingApprovalCount: 0,
            lastActivityAt: hoursAgo(2)
        ),
        Project(
            id: "proj-api",
            name: "Modesto API",
            workspacePath: "~/dev/modesto-api",
            hostId: "host-buildbox",
            defaultBranch: "develop",
            isPinned: false,
            activeSessionCount: 0,
            pendingApprovalCount: 0,
            lastActivityAt: hoursAgo(19)
        ),
    ]

    // MARK: Agent sessions

    static let sessions: [AgentSession] = [
        AgentSession(
            id: "sess-1",
            projectId: "proj-modesto",
            title: "Fix terminal reconnect race",
            providerKind: .claudeAgent,
            status: .running,
            branch: "fix/terminal-reconnect",
            worktreePath: "~/dev/modesto/.worktrees/fix-terminal-reconnect",
            lastMessagePreview: "Reproducing the race with a scripted reconnect loop before touching ptySession.ts.",
            progress: SessionProgress(
                currentStep: "Writing a regression test for the reconnect race",
                completedSteps: ["Investigated flaky reconnect on VPN sleep/wake", "Found the root cause: dropped ack sequence"],
                pendingSteps: ["Update ptySession.ts", "Open pull request"],
                changedFileCount: 1,
                testStatus: .passed,
                testSummary: "12 passed, 0 failed"
            ),
            createdAt: hoursAgo(1),
            updatedAt: minutesAgo(1)
        ),
        AgentSession(
            id: "sess-2",
            projectId: "proj-modesto",
            title: "Add iOS companion scaffold",
            providerKind: .codex,
            status: .waitingForApproval,
            branch: "feat/ios-companion",
            worktreePath: "~/dev/modesto/.worktrees/ios-companion",
            lastMessagePreview: "Requesting to run `xcodegen generate` in apps/ios.",
            progress: SessionProgress(
                currentStep: "Waiting on approval to run xcodegen generate",
                completedSteps: ["Wrote project.yml", "Wrote Swift source files"],
                pendingSteps: ["Generate Xcode project", "Build and verify"],
                changedFileCount: 1,
                testStatus: .none,
                testSummary: nil
            ),
            createdAt: minutesAgo(30),
            updatedAt: minutesAgo(1)
        ),
        AgentSession(
            id: "sess-5",
            projectId: "proj-modesto",
            title: "Update AGENTS.md model table",
            providerKind: .pi,
            status: .waitingForApproval,
            branch: "docs/agents-model-table",
            worktreePath: nil,
            lastMessagePreview: "Requesting to edit AGENTS.md directly.",
            progress: SessionProgress(
                currentStep: "Waiting on approval to edit AGENTS.md",
                completedSteps: ["Drafted the updated model ranking table"],
                pendingSteps: ["Apply the edit", "Verify formatting"],
                changedFileCount: 0,
                testStatus: .none,
                testSummary: nil
            ),
            createdAt: minutesAgo(15),
            updatedAt: minutesAgo(10)
        ),
        AgentSession(
            id: "sess-3",
            projectId: "proj-marketing",
            title: "Refresh pricing copy",
            providerKind: .claudeAgent,
            status: .waitingForInput,
            branch: "content/pricing-refresh",
            worktreePath: "~/dev/modesto-marketing/.worktrees/pricing-refresh",
            lastMessagePreview: "Which plan names should replace “Pro” and “Team”?",
            progress: SessionProgress(
                currentStep: "Waiting on your answer about plan names",
                completedSteps: ["Drafted new homepage copy"],
                pendingSteps: ["Apply to pricing.mdx", "Open pull request"],
                changedFileCount: 0,
                testStatus: .none,
                testSummary: nil
            ),
            createdAt: hoursAgo(3),
            updatedAt: minutesAgo(40)
        ),
        AgentSession(
            id: "sess-4",
            projectId: "proj-api",
            title: "Investigate slow /threads query",
            providerKind: .droid,
            status: .completed,
            branch: nil,
            worktreePath: nil,
            lastMessagePreview: "Added an index on (project_id, updated_at); p95 dropped 420ms → 40ms.",
            progress: SessionProgress(
                currentStep: nil,
                completedSteps: ["Ran EXPLAIN ANALYZE on the threads query", "Added an index on (project_id, updated_at)", "Verified p95 dropped to 40ms"],
                pendingSteps: [],
                changedFileCount: 2,
                testStatus: .passed,
                testSummary: "8 passed, 0 failed"
            ),
            createdAt: hoursAgo(20),
            updatedAt: hoursAgo(19)
        ),
    ]

    // MARK: Approvals

    static let approvals: [Approval] = [
        Approval(
            id: "appr-1",
            sessionId: "sess-2",
            projectId: "proj-modesto",
            kind: .command,
            title: "Run xcodegen generate",
            detail: "cd apps/ios && xcodegen generate",
            requestedAt: minutesAgo(1),
            decision: nil
        ),
        Approval(
            id: "appr-2",
            sessionId: "sess-5",
            projectId: "proj-modesto",
            kind: .fileChange,
            title: "Edit AGENTS.md",
            detail: "AGENTS.md",
            requestedAt: minutesAgo(10),
            decision: nil
        ),
    ]

    // MARK: Session events

    static let events: [SessionEvent] = [
        SessionEvent(id: "ev-1-1", sessionId: "sess-1", projectId: "proj-modesto", kind: .userMessage, summary: "Investigate flaky terminal reconnect on VPN sleep/wake.", detail: nil, createdAt: hoursAgo(1)),
        SessionEvent(id: "ev-1-2", sessionId: "sess-1", projectId: "proj-modesto", kind: .assistantMessage, summary: "Found it — we drop the ack sequence on resume. Writing a regression test first.", detail: nil, createdAt: minutesAgo(40)),
        SessionEvent(id: "ev-1-3", sessionId: "sess-1", projectId: "proj-modesto", kind: .toolCall, summary: "Ran `bun run test terminal`", detail: "12 passed, 0 failed", createdAt: minutesAgo(15)),
        SessionEvent(id: "ev-1-4", sessionId: "sess-1", projectId: "proj-modesto", kind: .fileChange, summary: "apps/server/src/terminal/ptySession.ts", detail: "+18 −4", createdAt: minutesAgo(2)),

        SessionEvent(id: "ev-2-1", sessionId: "sess-2", projectId: "proj-modesto", kind: .userMessage, summary: "Scaffold the iOS app per the goal.", detail: nil, createdAt: minutesAgo(30)),
        SessionEvent(id: "ev-2-2", sessionId: "sess-2", projectId: "proj-modesto", kind: .toolCall, summary: "Wrote apps/ios/project.yml", detail: nil, createdAt: minutesAgo(6)),
        SessionEvent(id: "ev-2-3", sessionId: "sess-2", projectId: "proj-modesto", kind: .approvalRequested, summary: "Run xcodegen generate", detail: nil, createdAt: minutesAgo(1)),

        SessionEvent(id: "ev-5-1", sessionId: "sess-5", projectId: "proj-modesto", kind: .userMessage, summary: "Update the model ranking table with fable-5.", detail: nil, createdAt: minutesAgo(15)),
        SessionEvent(id: "ev-5-2", sessionId: "sess-5", projectId: "proj-modesto", kind: .approvalRequested, summary: "Edit AGENTS.md", detail: nil, createdAt: minutesAgo(10)),

        SessionEvent(id: "ev-3-1", sessionId: "sess-3", projectId: "proj-marketing", kind: .userMessage, summary: "Refresh homepage pricing copy for the new tiers.", detail: nil, createdAt: hoursAgo(3)),
        SessionEvent(id: "ev-3-2", sessionId: "sess-3", projectId: "proj-marketing", kind: .assistantMessage, summary: "Drafted new copy — need your call on plan names before I touch pricing.mdx.", detail: nil, createdAt: minutesAgo(40)),

        SessionEvent(id: "ev-4-1", sessionId: "sess-4", projectId: "proj-api", kind: .userMessage, summary: "p95 on /threads is 420ms, investigate.", detail: nil, createdAt: hoursAgo(20)),
        SessionEvent(id: "ev-4-2", sessionId: "sess-4", projectId: "proj-api", kind: .toolCall, summary: "Ran EXPLAIN ANALYZE on the threads query", detail: nil, createdAt: hoursAgo(19.5)),
        SessionEvent(id: "ev-4-3", sessionId: "sess-4", projectId: "proj-api", kind: .gitAction, summary: "Committed 4f9c1a2 on develop", detail: nil, createdAt: hoursAgo(19.2)),
        SessionEvent(id: "ev-4-4", sessionId: "sess-4", projectId: "proj-api", kind: .statusChanged, summary: "Session completed", detail: nil, createdAt: hoursAgo(19)),
    ]

    // MARK: Terminal streams

    static let terminals: [String: TerminalStream] = [
        "sess-1": TerminalStream(
            id: "term-sess-1",
            sessionId: "sess-1",
            cwd: "~/dev/modesto/.worktrees/fix-terminal-reconnect",
            status: .running,
            lines: [
                TerminalLine(id: "t1", text: "bun run test terminal", isCommand: true, timestamp: minutesAgo(16)),
                TerminalLine(id: "t2", text: "bun test v1.3.9 (terminal suite)", isCommand: false, timestamp: minutesAgo(16)),
                TerminalLine(id: "t3", text: "✓ reconnect resumes ack sequence after sleep/wake", isCommand: false, timestamp: minutesAgo(15)),
                TerminalLine(id: "t4", text: "12 pass, 0 fail, 0 skip", isCommand: false, timestamp: minutesAgo(15)),
                TerminalLine(id: "t5", text: "git status --short", isCommand: true, timestamp: minutesAgo(2)),
                TerminalLine(id: "t6", text: " M apps/server/src/terminal/ptySession.ts", isCommand: false, timestamp: minutesAgo(2)),
            ]
        ),
    ]

    // MARK: Git status

    static let gitStatuses: [String: GitStatusSummary] = [
        "proj-modesto": GitStatusSummary(
            branch: GitBranchSummary(name: "fix/terminal-reconnect", isDefault: false, upstream: "origin/fix/terminal-reconnect", ahead: 3, behind: 0),
            hasUncommittedChanges: true,
            changedFiles: [
                ChangedFile(path: "apps/server/src/terminal/ptySession.ts", kind: .modified, additions: 18, deletions: 4),
                ChangedFile(path: "apps/ios/project.yml", kind: .added, additions: 48, deletions: 0),
                ChangedFile(path: "AGENTS.md", kind: .modified, additions: 3, deletions: 1),
            ],
            pullRequest: GitPullRequestSummary(id: 142, title: "Fix terminal reconnect race on wake", url: "https://github.com/Syphon1205/Modesto/pull/142", state: "open", isDraft: true, checksPassing: nil)
        ),
        "proj-marketing": GitStatusSummary(
            branch: GitBranchSummary(name: "content/pricing-refresh", isDefault: false, upstream: "origin/content/pricing-refresh", ahead: 1, behind: 0),
            hasUncommittedChanges: true,
            changedFiles: [
                ChangedFile(path: "src/content/pricing.mdx", kind: .modified, additions: 22, deletions: 15),
            ],
            pullRequest: nil
        ),
        "proj-api": GitStatusSummary(
            branch: GitBranchSummary(name: "develop", isDefault: true, upstream: "origin/develop", ahead: 0, behind: 0),
            hasUncommittedChanges: false,
            changedFiles: [],
            pullRequest: nil
        ),
    ]

    static let diffs: [String: FileDiff] = [
        "AGENTS.md": FileDiff(
            path: "AGENTS.md",
            hunks: [
                DiffHunk(
                    id: "hunk-agents-1",
                    header: "@@ -8,7 +8,7 @@ Rankings, higher = better.",
                    lines: [
                        DiffLine(id: "a1", kind: .context, text: "| model       | cost | intelligence | taste |"),
                        DiffLine(id: "a2", kind: .deletion, text: "| gpt-5.5-sol | 9    | 8            | 5     |"),
                        DiffLine(id: "a3", kind: .addition, text: "| gpt-5.6-sol | 9    | 8            | 5     |"),
                        DiffLine(id: "a4", kind: .context, text: "| sonnet-5    | 5    | 5            | 7     |"),
                        DiffLine(id: "a5", kind: .addition, text: "| fable-5     | 2    | 9            | 9     |"),
                    ]
                ),
            ]
        ),
        "apps/server/src/terminal/ptySession.ts": FileDiff(
            path: "apps/server/src/terminal/ptySession.ts",
            hunks: [
                DiffHunk(
                    id: "hunk-1",
                    header: "@@ -41,6 +41,10 @@ function resume(session: PtySession) {",
                    lines: [
                        DiffLine(id: "l1", kind: .context, text: "  session.status = \"running\";"),
                        DiffLine(id: "l2", kind: .addition, text: "  if (session.lastAckSequence !== session.sentSequence) {"),
                        DiffLine(id: "l3", kind: .addition, text: "    session.replaySince(session.lastAckSequence);"),
                        DiffLine(id: "l4", kind: .addition, text: "  }"),
                        DiffLine(id: "l5", kind: .context, text: "  session.emit(\"resumed\");"),
                    ]
                ),
            ]
        ),
    ]

    // MARK: Deployments

    static let deployments: [String: [Deployment]] = [
        "proj-marketing": [
            Deployment(
                id: "dep-1",
                projectId: "proj-marketing",
                provider: .vercel,
                environment: "Preview",
                status: .ready,
                url: "https://modesto-marketing-git-content-pricing-refresh.vercel.app",
                commitMessage: "content: refresh pricing copy",
                createdAt: minutesAgo(35)
            ),
            Deployment(
                id: "dep-2",
                projectId: "proj-marketing",
                provider: .vercel,
                environment: "Production",
                status: .ready,
                url: "https://modesto.dev",
                commitMessage: "chore: release 0.1.2",
                createdAt: hoursAgo(30)
            ),
        ],
        "proj-modesto": [],
        "proj-api": [],
    ]
}
