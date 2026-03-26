import { describe, expect, test } from "bun:test"
import { SessionCompaction } from "../../src/session/compaction"
import { MessageV2 } from "../../src/session/message-v2"
import { ModelID, ProviderID } from "../../src/provider/schema"
import { MessageID, PartID, SessionID } from "../../src/session/schema"

const sessionID = SessionID.make("session")
const providerID = ProviderID.make("test")

function user(id: string): MessageV2.User {
  return {
    id: MessageID.make(id),
    sessionID,
    role: "user",
    time: { created: 0 },
    agent: "build",
    model: { providerID, modelID: ModelID.make("test") },
    tools: {},
  } as MessageV2.User
}

function assistant(id: string, parentID: string, summary?: boolean): MessageV2.Assistant {
  return {
    id: MessageID.make(id),
    sessionID,
    role: "assistant",
    time: { created: 0, completed: 1 },
    parentID: MessageID.make(parentID),
    modelID: ModelID.make("test"),
    providerID,
    mode: "build",
    agent: "build",
    path: { cwd: "/", root: "/" },
    summary,
    finish: "stop",
    cost: 0,
    tokens: {
      input: 0,
      output: 0,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    },
  } as MessageV2.Assistant
}

function compaction(messageID: string, id: string): MessageV2.CompactionPart {
  return {
    id: PartID.make(id),
    sessionID,
    messageID: MessageID.make(messageID),
    type: "compaction",
    auto: true,
  }
}

describe("session.compaction.prepare", () => {
  test("drops the current pending compaction trigger and later queued turns", () => {
    const input: MessageV2.WithParts[] = [
      {
        info: user("message-1"),
        parts: [
          {
            id: PartID.make("part-1"),
            sessionID,
            messageID: MessageID.make("message-1"),
            type: "text",
            text: "first",
          },
        ],
      },
      {
        info: user("message-2"),
        parts: [compaction("message-2", "part-2")],
      },
      {
        info: assistant("message-3", "message-2", true),
        parts: [
          {
            id: PartID.make("part-3"),
            sessionID,
            messageID: MessageID.make("message-3"),
            type: "text",
            text: "summary",
          },
        ],
      },
      {
        info: user("message-4"),
        parts: [
          {
            id: PartID.make("part-4"),
            sessionID,
            messageID: MessageID.make("message-4"),
            type: "text",
            text: "continue",
          },
        ],
      },
      {
        info: user("message-5"),
        parts: [compaction("message-5", "part-5")],
      },
    ]

    const result = SessionCompaction.prepare({
      messages: input,
      parentID: MessageID.make("message-5"),
    })

    expect(result.map((msg) => msg.info.id)).toStrictEqual([
      MessageID.make("message-1"),
      MessageID.make("message-2"),
      MessageID.make("message-3"),
      MessageID.make("message-4"),
    ])
  })

  test("drops queued user turns after the pending compaction trigger", () => {
    const input: MessageV2.WithParts[] = [
      {
        info: user("message-1"),
        parts: [
          {
            id: PartID.make("part-1"),
            sessionID,
            messageID: MessageID.make("message-1"),
            type: "text",
            text: "first",
          },
        ],
      },
      {
        info: user("message-2"),
        parts: [compaction("message-2", "part-2")],
      },
      {
        info: user("message-3"),
        parts: [
          {
            id: PartID.make("part-3"),
            sessionID,
            messageID: MessageID.make("message-3"),
            type: "text",
            text: "queued",
          },
        ],
      },
    ]

    const result = SessionCompaction.prepare({
      messages: input,
      parentID: MessageID.make("message-2"),
    })

    expect(result.map((msg) => msg.info.id)).toStrictEqual([MessageID.make("message-1")])
  })
})

describe("session.compaction.hasQueuedUser", () => {
  test("returns true when a real user message exists after the compaction trigger", () => {
    const input: MessageV2.WithParts[] = [
      {
        info: user("message-1"),
        parts: [compaction("message-1", "part-1")],
      },
      {
        info: assistant("message-2", "message-1", true),
        parts: [],
      },
      {
        info: user("message-3"),
        parts: [
          {
            id: PartID.make("part-3"),
            sessionID,
            messageID: MessageID.make("message-3"),
            type: "text",
            text: "queued",
          },
        ],
      },
    ]

    expect(SessionCompaction.hasQueuedUser(input, MessageID.make("message-1"))).toBe(true)
  })

  test("returns false when only assistant messages follow the compaction trigger", () => {
    const input: MessageV2.WithParts[] = [
      {
        info: user("message-1"),
        parts: [compaction("message-1", "part-1")],
      },
      {
        info: assistant("message-2", "message-1", true),
        parts: [],
      },
    ]

    expect(SessionCompaction.hasQueuedUser(input, MessageID.make("message-1"))).toBe(false)
  })
})
