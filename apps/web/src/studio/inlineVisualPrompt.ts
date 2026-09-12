export const INLINE_VISUAL_INSTRUCTIONS = `Modesto can display diagrams and interactive visuals directly in chat. For a diagram, use a mermaid code fence. For a chart, calculator, simulation, or interactive widget, use one complete html code fence with its CSS and JavaScript included in that document. Use SVG or canvas for graphs, include accessible labels and working controls, and make it responsive. The preview runs after the response finishes in an isolated frame: no parent-page access, local file access, or persistence. Prefer self-contained code and embedded data. For image generation requests, use the available image tools and link the resulting image instead of substituting an HTML drawing. Include a brief explanation outside the visual.`;

const PREFIX = `${INLINE_VISUAL_INSTRUCTIONS}\n\nUser request:\n`;

export function buildInlineVisualPrompt(request: string): string {
  return `${PREFIX}${request}`;
}

export function stripInlineVisualInstructions(prompt: string): string {
  return prompt.startsWith(PREFIX) ? prompt.slice(PREFIX.length) : prompt;
}
