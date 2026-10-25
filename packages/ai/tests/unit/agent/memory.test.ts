import {
  AIMessage,
  HumanMessage,
  RemoveMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { describe, expect, it } from "vitest";

import {
  pruneOldTurns,
  recentTurns,
  repairToolPairs,
  seedMessages,
  summariseOldTurns,
} from "../../../src/agent/memory";

function turn(index: number, withTool = false): BaseMessage[] {
  const human = new HumanMessage({ content: `question ${index}`, id: `h${index}` });
  if (!withTool) return [human, new AIMessage({ content: `answer ${index}`, id: `a${index}` })];
  return [
    human,
    new AIMessage({
      content: "",
      id: `c${index}`,
      tool_calls: [{ id: `call${index}`, name: "trip_get", args: {}, type: "tool_call" }],
    }),
    new ToolMessage({ content: "{}", tool_call_id: `call${index}`, id: `t${index}` }),
    new AIMessage({ content: `answer ${index}`, id: `a${index}` }),
  ];
}

const text = (messages: BaseMessage[]) => messages.map((message) => message.text);

describe("recentTurns", () => {
  it("keeps the last whole turns, tool results included", () => {
    const messages = [...turn(1), ...turn(2, true), ...turn(3)];
    expect(text(recentTurns(messages, 2))).toEqual(["question 2", "", "{}", "answer 2", "question 3", "answer 3"]);
  });

  it("keeps everything when there are fewer turns", () => {
    const messages = turn(1);
    expect(recentTurns(messages, 5)).toHaveLength(2);
  });
});

describe("repairToolPairs", () => {
  it("drops a tool call that never got its result", () => {
    const dangling = new AIMessage({
      content: "Let me check.",
      id: "x",
      tool_calls: [{ id: "lost", name: "trip_get", args: {}, type: "tool_call" }],
    });
    const repaired = repairToolPairs([...turn(1, true), new HumanMessage("again"), dangling]);

    expect(repaired.at(-1)).toBeInstanceOf(AIMessage);
    expect((repaired.at(-1) as AIMessage).tool_calls ?? []).toHaveLength(0);
    expect(repaired.at(-1)?.text).toBe("Let me check.");
    expect(repaired).toHaveLength(6);
  });

  it("leaves answered tool calls alone", () => {
    const messages = turn(1, true);
    expect(repairToolPairs(messages)).toEqual(messages);
  });
});

describe("pruneOldTurns", () => {
  it("removes the oldest whole turns once memory is over the limit", () => {
    const messages = [...turn(1, true), ...turn(2), ...turn(3)];
    const removed = pruneOldTurns(messages, 4);

    expect(removed.every((message) => message instanceof RemoveMessage)).toBe(true);
    expect(removed.map((message) => message.id)).toEqual(["h1", "c1", "t1", "a1"]);
  });

  it("does nothing under the limit", () => {
    expect(pruneOldTurns(turn(1), 10)).toEqual([]);
  });
});

describe("summariseOldTurns", () => {
  it("replaces the oldest turns with a summary instead of dropping them silently", () => {
    const messages = [...turn(1, true), ...turn(2), ...turn(3)];
    const update = summariseOldTurns(messages, 4);

    expect(update[0]).toBeInstanceOf(RemoveMessage);
    expect(update.map((message) => message.id).slice(0, 4)).toEqual(["h1", "c1", "t1", "a1"]);
    const summary = update.at(-1);
    expect(summary).toBeInstanceOf(AIMessage);
    expect(summary?.text).toContain("[Earlier in this chat]");
    expect(summary?.text).toContain("trip_get");
  });

  it("does nothing under the limit", () => {
    expect(summariseOldTurns(turn(1), 10)).toEqual([]);
  });
});

describe("seedMessages", () => {
  it("starts with the advisor, ends with a reply, merges repeats and redacts", () => {
    const seeded = seedMessages(
      [
        { role: "assistant", content: "Welcome" },
        { role: "user", content: "Trip for Mehta" },
        { role: "user", content: "Passport number: K1234567" },
        { role: "assistant", content: "Which Mehta?" },
        { role: "user", content: "still typing" },
      ],
      10,
    );

    expect(seeded.map((message) => message.getType())).toEqual(["human", "ai"]);
    expect(seeded[0]?.text).toBe("Trip for Mehta\n\nPassport number: [shown to the advisor only]");
  });
});
