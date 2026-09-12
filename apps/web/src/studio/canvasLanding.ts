export function shouldShowCanvasLanding(input: {
  readonly started: boolean;
  readonly dashboardIsStarter: boolean;
  readonly docsIsStarter: boolean;
  readonly sheetsIsStarter: boolean;
  readonly slidesIsStarter: boolean;
}): boolean {
  if (input.started) return false;
  return (
    input.dashboardIsStarter &&
    input.docsIsStarter &&
    input.sheetsIsStarter &&
    input.slidesIsStarter
  );
}
