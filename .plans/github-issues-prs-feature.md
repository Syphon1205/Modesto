# GitHub Issues & Pull Requests Integration

## Recap

Add a GitHub Issues and Pull Requests panel to modesto so users can browse, review,
and tackle issues/PRs directly from the UI — without leaving the app. The coding
agent can be assigned to fix an issue or address PR review feedback in-context.

**Cost:** Free. The GitHub REST/GraphQL APIs are free for public and private repos
(5,000 req/hour with a Personal Access Token).

**Dependency:** `octokit` (GitHub's official JS/TS SDK, MIT-licensed).

---

## Architecture Overview

```
┌─────────────┐       ┌──────────────────┐       ┌──────────────┐
│  apps/web    │ WS ↔  │  apps/server     │  ───→ │ GitHub API   │
│  (React UI)  │       │  (GitHub service) │       │ (REST/GQL)   │
└─────────────┘       └──────────────────┘       └──────────────┘
       │                       │
       │ uses schemas from     │ uses schemas from
       ▼                       ▼
┌──────────────────────────────────┐
│  packages/contracts/src/github.ts │
└──────────────────────────────────┘
```

- **Server-side**: A GitHub service on `apps/server` holds the PAT, makes API calls
  via `octokit`, and exposes results over WebSocket.
- **Client-side**: React components fetch data through the existing WS layer using
  TanStack Query for caching/pagination.
- **Contracts**: Effect schemas in `packages/contracts` define shared types for
  issues, PRs, reviews, comments, check runs, etc.

---

## Phase 1 — Authentication & Token Management

### Goal
Let the user provide a GitHub PAT and persist it securely.

### Changes

| File | Action | Details |
|---|---|---|
| `packages/contracts/src/github.ts` | CREATE | Effect schemas: `GitHubTokenInput`, `GitHubRepo` (owner + repo parsed from git remote) |
| `apps/web` — settings/config UI | MODIFY | Add a "GitHub Token" input field in settings; store token in persisted state |
| `apps/server` — GitHub service | CREATE | `GitHubService` class: accepts token, initializes `octokit`, exposes API methods |
| `apps/server` — WS routes | MODIFY | Add `github:set-token` WS message to pass token to the server-side service |

### Verification
- User enters a PAT in settings → server validates it with `GET /user` → shows username confirmation.

---

## Phase 2 — Issues Panel

### Goal
List, view, and filter GitHub issues for the connected repository.

### Changes

| File | Action | Details |
|---|---|---|
| `packages/contracts/src/github.ts` | MODIFY | Add schemas: `GitHubIssue`, `GitHubLabel`, `GitHubIssueComment`, `ListIssuesInput` (filters: state, labels, assignee, page) |
| `apps/server` — GitHub service | MODIFY | Add methods: `listIssues()`, `getIssue()`, `getIssueComments()`, `addIssueComment()` |
| `apps/server` — WS routes | MODIFY | Add WS channels: `github:list-issues`, `github:get-issue`, `github:issue-comments`, `github:add-comment` |
| `apps/web` — `IssuesPanel.tsx` | CREATE | List view with filters (open/closed, labels, search). Each row: title, number, labels, assignee, updated date |
| `apps/web` — `IssueDetail.tsx` | CREATE | Full issue view: markdown body, comments thread, labels, "Tackle this issue" button |
| `apps/web` — routing/sidebar | MODIFY | Add "Issues" tab/section in sidebar or as a panel toggle |

### UX Flow
```
Sidebar "Issues" tab → List of issues (filterable) → Click issue → Issue detail view
                                                                         │
                                                            "Tackle this issue"
                                                                         │
                                                          ┌──────────────▼──────────────┐
                                                          │ Auto-create branch from issue│
                                                          │ Feed issue context to agent  │
                                                          │ Agent works on the fix       │
                                                          └─────────────────────────────┘
```

### Verification
- Open Issues panel → see repo's open issues.
- Click an issue → see body + comments rendered as markdown.
- Click "Tackle this issue" → branch created, agent receives issue context.

---

## Phase 3 — Pull Requests Panel

### Goal
List, view, and inspect pull requests with diffs and CI status.

### Changes

| File | Action | Details |
|---|---|---|
| `packages/contracts/src/github.ts` | MODIFY | Add schemas: `GitHubPullRequest`, `GitHubPRReview`, `GitHubReviewComment`, `GitHubCheckRun`, `ListPRsInput` |
| `apps/server` — GitHub service | MODIFY | Add methods: `listPRs()`, `getPR()`, `getPRDiff()`, `getPRReviews()`, `getPRCheckRuns()` |
| `apps/server` — WS routes | MODIFY | Add WS channels for each PR method |
| `apps/web` — `PRListPanel.tsx` | CREATE | List view: title, number, author, status (draft/open/merged/closed), CI badge, review state |
| `apps/web` — `PRDetail.tsx` | CREATE | PR detail: description, diff viewer, review comments, CI status |
| `apps/web` — routing/sidebar | MODIFY | Add "Pull Requests" tab next to "Issues" |

### Verification
- Open PRs panel → see repo's open PRs.
- Click a PR → see description, diff, and CI status.

---

## Phase 4 — PR Review & Inline Comments

### Goal
Let users read and respond to review comments, and ask the agent to fix review feedback.

### Changes

| File | Action | Details |
|---|---|---|
| `apps/web` — `DiffViewer.tsx` | CREATE | Side-by-side or unified diff viewer with inline comment threads (use `react-diff-view` or similar) |
| `apps/web` — `ReviewThread.tsx` | CREATE | Threaded comment display per diff hunk; reply box for each thread |
| `apps/server` — GitHub service | MODIFY | Add methods: `addReviewComment()`, `submitReview()`, `replyToReviewComment()` |
| `apps/web` — `PRDetail.tsx` | MODIFY | Add "Fix review feedback" button: collects all unresolved review comments → feeds them to the agent as context |

### UX Flow
```
PR Detail → Diff tab → See inline review comments
                              │
                    "Fix review feedback"
                              │
                ┌─────────────▼─────────────┐
                │ Agent reads all unresolved │
                │ comments → makes fixes →   │
                │ commits → pushes to branch │
                └───────────────────────────┘
```

### Verification
- Open a PR with review comments → see comments inline on the diff.
- Reply to a comment → appears on GitHub.
- Click "Fix review feedback" → agent addresses each comment, pushes fixes.

---

## Phase 5 — CI Status & Real-time Updates

### Goal
Show CI check statuses and optionally poll/webhook for live updates.

### Changes

| File | Action | Details |
|---|---|---|
| `apps/server` — GitHub service | MODIFY | Add polling for check run status (configurable interval, e.g. 30s) |
| `apps/web` — `CIStatusBadge.tsx` | CREATE | Badge component: pending/success/failure/error with link to details |
| `apps/web` — `PRDetail.tsx` | MODIFY | Show CI status section; "Fix CI" button feeds failure logs to agent |

### Verification
- PR detail shows CI badges updating as checks run.
- Click "Fix CI" on a failed check → agent sees failure logs and attempts a fix.

---

## Implementation Order

| Order | Phase | Effort | Depends on |
|---|---|---|---|
| 1 | Phase 1 — Auth & Token | Small | — |
| 2 | Phase 2 — Issues Panel | Medium | Phase 1 |
| 3 | Phase 3 — PR List & Detail | Medium | Phase 1 |
| 4 | Phase 4 — PR Review & Diff | Large | Phase 3 |
| 5 | Phase 5 — CI & Real-time | Medium | Phase 3 |

Phases 2 and 3 can be built in parallel after Phase 1 is done.

---

## Key API Endpoints Used (all free)

| Action | GitHub API |
|---|---|
| Validate token | `GET /user` |
| List issues | `GET /repos/{owner}/{repo}/issues` |
| Get issue | `GET /repos/{owner}/{repo}/issues/{number}` |
| Issue comments | `GET /repos/{owner}/{repo}/issues/{number}/comments` |
| List PRs | `GET /repos/{owner}/{repo}/pulls` |
| Get PR | `GET /repos/{owner}/{repo}/pulls/{number}` |
| PR diff | `GET /repos/{owner}/{repo}/pulls/{number}` (Accept: diff) |
| PR reviews | `GET /repos/{owner}/{repo}/pulls/{number}/reviews` |
| Review comments | `GET /repos/{owner}/{repo}/pulls/{number}/comments` |
| Check runs | `GET /repos/{owner}/{repo}/commits/{sha}/check-runs` |
| Post comment | `POST /repos/{owner}/{repo}/issues/{number}/comments` |
| Reply to review | `POST /repos/{owner}/{repo}/pulls/{number}/comments/{id}/replies` |

---

## Edge Cases & Considerations

- **No token set**: Show a prompt to add a GitHub token; disable panels until configured.
- **Token expired/revoked**: Catch 401, show re-auth prompt.
- **Private repos**: Work fine with `repo` scope on the PAT.
- **Rate limiting**: Cache aggressively with TanStack Query; show rate-limit info if close to cap.
- **Large diffs**: Paginate or truncate diffs over a threshold; show "View on GitHub" fallback.
- **Repos with many issues**: Server-side pagination, client-side infinite scroll.
- **Not a git repo / no remote**: Gracefully disable GitHub panels with an explanation message.

---

## New Dependencies

| Package | Purpose | License |
|---|---|---|
| `octokit` | GitHub API client | MIT |
| `react-diff-view` | Diff rendering with inline comments | MIT |
| `unidiff` (or `parse-diff`) | Parse unified diff format | MIT |
