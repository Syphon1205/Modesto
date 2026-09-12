import { Children, cloneElement, isValidElement, type ReactNode } from "react";

import { webAppIcon } from "~/components/WebAppIcons";
import { resolveWebAppMention } from "~/connections/webApps";
import { cn } from "~/lib/utils";

import {
  CHAT_INLINE_CHIP_CLASS_NAME,
  CHAT_INLINE_CHIP_LABEL_CLASS_NAME,
  COMPOSER_INLINE_CHIP_ICON_CLASS_NAME,
} from "../composerInlineChip";

const WEB_APP_TOKEN_REGEX = /(^|\s)@([A-Za-z][A-Za-z0-9_-]*)(?=\s|$)/g;

export function WebAppMentionInlineText(props: { text: string }) {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of props.text.matchAll(WEB_APP_TOKEN_REGEX)) {
    const prefix = match[1] ?? "";
    const token = match[2] ?? "";
    const app = resolveWebAppMention(token);
    if (!app) continue;
    const start = (match.index ?? 0) + prefix.length;
    const rawText = `@${token}`;
    if (start > cursor) {
      nodes.push(props.text.slice(cursor, start));
    }
    nodes.push(
      <WebAppMentionChip
        key={`${start}:${token}`}
        appName={app.name}
        appId={app.id}
        rawText={rawText}
      />,
    );
    cursor = start + rawText.length;
  }

  if (cursor === 0) {
    return <>{props.text}</>;
  }
  if (cursor < props.text.length) {
    nodes.push(props.text.slice(cursor));
  }
  return <>{nodes}</>;
}

export function renderWebAppMentionMarkdownChildren(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string") {
      return <WebAppMentionInlineText text={child} />;
    }
    if (!isValidElement<{ children?: ReactNode; node?: { tagName?: string } }>(child)) {
      return child;
    }
    const markdownTagName = typeof child.type === "string" ? child.type : child.props.node?.tagName;
    if (markdownTagName === "code" || markdownTagName === "a") {
      return child;
    }
    if (!("children" in child.props)) {
      return child;
    }
    return cloneElement(
      child,
      undefined,
      renderWebAppMentionMarkdownChildren(child.props.children),
    );
  });
}

function WebAppMentionChip(props: {
  readonly appId: string;
  readonly appName: string;
  readonly rawText: string;
}) {
  const Icon = webAppIcon(props.appId);
  return (
    <span className="inline-flex align-middle leading-none" data-markdown-copy={props.rawText}>
      <span className={cn(CHAT_INLINE_CHIP_CLASS_NAME)}>
        <Icon className={COMPOSER_INLINE_CHIP_ICON_CLASS_NAME} aria-hidden />
        <span className={CHAT_INLINE_CHIP_LABEL_CLASS_NAME}>{props.appName}</span>
      </span>
    </span>
  );
}
