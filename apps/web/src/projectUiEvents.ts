// FILE: projectUiEvents.ts
// Purpose: Shared browser event for opening the sidebar's add-project flow from route surfaces.
// Layer: App-level UI coordination

export const OPEN_ADD_PROJECT_EVENT = "modesto:open-add-project";

export function requestOpenAddProject(): void {
  window.dispatchEvent(new Event(OPEN_ADD_PROJECT_EVENT));
}
