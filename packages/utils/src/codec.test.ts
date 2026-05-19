import { describe, expect, it } from "vitest";
import { applyLineEnding, encodeText, createStreamingDecoder } from "./codec";

describe("applyLineEnding", () => {
  it("returns text as-is for 'none'", () => {
    expect(applyLineEnding("hello", "none")).toBe("hello");
  });

  it("appends LF for 'lf'", () => {
    expect(applyLineEnding("hello", "lf")).toBe("hello\n");
  });

  it("appends CRLF for 'crlf'", () => {
    expect(applyLineEnding("hello", "crlf")).toBe("hello\r\n");
  });
});

describe("encodeText", () => {
  it("encodes text to Uint8Array", () => {
    const result = encodeText("AB");
    expect(result).toEqual(new Uint8Array([0x41, 0x42]));
  });

  it("appends line ending before encoding", () => {
    const result = encodeText("AB", "lf");
    expect(result).toEqual(new Uint8Array([0x41, 0x42, 0x0a]));
  });

  it("defaults to no line ending", () => {
    const result = encodeText("AB");
    expect(result.length).toBe(2);
  });
});

describe("createStreamingDecoder", () => {
  it("returns a TextDecoder", () => {
    const decoder = createStreamingDecoder();
    expect(decoder).toBeInstanceOf(TextDecoder);
  });

  it("decodes UTF-8 bytes", () => {
    const decoder = createStreamingDecoder();
    const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    expect(decoder.decode(bytes)).toBe("Hello");
  });
});
