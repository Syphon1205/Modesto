import { inferEntryKindFromPath } from "../../pierre-icons";
import {
  CHAT_INLINE_CHIP_CLASS_NAME,
  CHAT_INLINE_CHIP_LABEL_CLASS_NAME,
  COMPOSER_INLINE_CHIP_CLASS_NAME,
  COMPOSER_INLINE_CHIP_ICON_CLASS_NAME,
  COMPOSER_INLINE_CHIP_LABEL_CLASS_NAME,
} from "../composerInlineChip";
import { nativeAppIcon } from "../NativeAppIcons";
import { webAppIcon } from "../WebAppIcons";
import { nativeAppForMentionPath } from "@modesto/shared/nativeApps";
import { webAppForMentionPath } from "../../connections/webApps";
import { PierreEntryIcon } from "./PierreEntryIcon";

export const FILE_TAG_CHIP_CLASS_NAME = COMPOSER_INLINE_CHIP_CLASS_NAME;
export const CHAT_FILE_TAG_CHIP_CLASS_NAME = CHAT_INLINE_CHIP_CLASS_NAME;

export function FileTagChipContent(props: {
  path: string;
  label: string;
  theme: "light" | "dark";
  selectable?: boolean;
}) {
  const app = webAppForMentionPath(props.path) ?? webAppForMentionPath(props.label);
  const nativeApp = nativeAppForMentionPath(props.path) ?? nativeAppForMentionPath(props.label);
  const labelClassName = props.selectable
    ? CHAT_INLINE_CHIP_LABEL_CLASS_NAME
    : COMPOSER_INLINE_CHIP_LABEL_CLASS_NAME;

  if (app) {
    const Icon = webAppIcon(app.id);
    return (
      <>
        <Icon className={COMPOSER_INLINE_CHIP_ICON_CLASS_NAME} aria-hidden />
        <span className={labelClassName}>{app.name}</span>
      </>
    );
  }

  if (nativeApp) {
    const Icon = nativeAppIcon(nativeApp.id);
    return (
      <>
        <Icon className={COMPOSER_INLINE_CHIP_ICON_CLASS_NAME} aria-hidden />
        <span className={labelClassName}>{nativeApp.name}</span>
      </>
    );
  }

  return (
    <>
      <PierreEntryIcon
        pathValue={props.path}
        kind={inferEntryKindFromPath(props.path)}
        theme={props.theme}
        className={COMPOSER_INLINE_CHIP_ICON_CLASS_NAME}
      />
      <span className={labelClassName}>{props.label}</span>
    </>
  );
}
