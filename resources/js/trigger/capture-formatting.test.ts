import { describe, expect, it } from "vitest";
import { interpolateSql } from "./capture-formatting";

describe("interpolateSql", () => {
  it("renders scalar bindings as readable SQL literals", () => {
    expect(interpolateSql(
      "select * from invoices where id = ? and paid = ? and note = ? and deleted_at is ?",
      [
        { position: 0, column: "id", value: 42 },
        { position: 1, column: "paid", value: true },
        { position: 2, column: "note", value: "O'Reilly" },
        { position: 3, column: "deleted_at", value: null },
      ],
    )).toBe("select * from invoices where id = 42 and paid = true and note = 'O''Reilly' and deleted_at is NULL");
  });

  it("does not replace question marks inside SQL strings, identifiers, or comments", () => {
    expect(interpolateSql(
      "select '?' as literal, \"?\" as identifier, `?` as mysql_name -- ?\nfrom invoices where id = ? /* ? */",
      [{ position: 0, column: "id", value: 7 }],
    )).toBe("select '?' as literal, \"?\" as identifier, `?` as mysql_name -- ?\nfrom invoices where id = 7 /* ? */");
  });

  it("preserves PostgreSQL JSON operators and dollar-quoted strings", () => {
    expect(interpolateSql(
      "select data ? 'enabled', body ?| array['ready'], $tag$?$tag$ from events where [event?] = ?",
      [{ position: 0, column: "event?", value: 9 }],
    )).toBe("select data ? 'enabled', body ?| array['ready'], $tag$?$tag$ from events where [event?] = 9");

    expect(interpolateSql(
      "select data ? ? from events where id = ?",
      [
        { position: 0, column: null, value: "enabled" },
        { position: 1, column: "id", value: 9 },
      ],
    )).toBe("select data ? 'enabled' from events where id = 9");
  });

  it("quotes redacted and JSON-compatible structured bindings", () => {
    expect(interpolateSql(
      "insert into events (token, payload) values (?, ?)",
      [
        { position: 0, column: "token", value: "[REDACTED]" },
        { position: 1, column: "payload", value: { ready: true } },
      ],
    )).toBe("insert into events (token, payload) values ('[REDACTED]', '{\"ready\":true}')");
  });
});
