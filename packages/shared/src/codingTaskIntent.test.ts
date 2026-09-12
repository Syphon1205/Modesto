import { describe, expect, it } from "vite-plus/test";

import { detectCodingTaskIntent } from "./codingTaskIntent.ts";

function task(prompt: string): string | null {
  return detectCodingTaskIntent(prompt)?.task ?? null;
}

describe("detectCodingTaskIntent", () => {
  it("matches explicit start/create of a project, repo, or code thread", () => {
    expect(task("start a project to add auth")).toBe("start a project to add auth");
    expect(task("Create a new coding task to fix the flaky test")).toBe(
      "Create a new coding task to fix the flaky test",
    );
    expect(task("start a code thread for the login page")).toBe(
      "start a code thread for the login page",
    );
    expect(task("can you start a project that implements billing")).toBe(
      "can you start a project that implements billing",
    );
    expect(task("let's start a repo for the cli")).toBe("let's start a repo for the cli");
    expect(task("I want you to start a project for the dashboard")).toBe(
      "I want you to start a project for the dashboard",
    );
    expect(task("start working on a project to add tests")).toBe(
      "start working on a project to add tests",
    );
    expect(task("please create an app that lists pull requests")).toBe(
      "please create an app that lists pull requests",
    );
  });

  it("matches start-a-task when the rest of the prompt is coding work", () => {
    expect(task("start a task to implement the API")).toBe("start a task to implement the API");
    expect(task("create a task to refactor the auth module")).toBe(
      "create a task to refactor the auth module",
    );
  });

  it("does not match questions, explanations, or incidental prose", () => {
    expect(task("what project should I start")).toBeNull();
    expect(task("explain this function")).toBeNull();
    expect(task("the main task is understanding the code")).toBeNull();
    expect(task("in this project we use layers")).toBeNull();
    expect(task("start a conversation about architecture")).toBeNull();
    expect(task("don't start a project")).toBeNull();
    expect(task("start a task: write a poem about the moon")).toBeNull();
  });

  it("ignores slash commands and tiny prompts", () => {
    expect(task("/multiagent fix the flaky test")).toBeNull();
    expect(task("/side")).toBeNull();
    expect(task("start")).toBeNull();
  });
});
