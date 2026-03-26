import { describe, expect, test } from "bun:test"
import { LLM } from "../../src/session/llm"

describe("session.llm.normalizeSystem", () => {
  test("collapses multiple fragments into one system prompt", () => {
    const system = ["provider prompt", "plugin prompt", "user prompt"]
    expect(LLM.normalizeSystem(system)).toStrictEqual(["provider prompt\nplugin prompt\nuser prompt"])
  })

  test("drops empty fragments", () => {
    const system = ["provider prompt", "", "plugin prompt"]
    expect(LLM.normalizeSystem(system)).toStrictEqual(["provider prompt\nplugin prompt"])
  })

  test("returns empty array when every fragment is empty", () => {
    const system = ["", ""]
    expect(LLM.normalizeSystem(system)).toStrictEqual([])
  })
})
