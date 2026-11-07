import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../lib/store.mjs";
import { createWhatsApp } from "../lib/whatsapp.mjs";
test("WhatsApp delivery failure remains retryable without repeating a confirmed event", async () => {
  const store = createStore(":memory:");
  let failing = true;
  const sent = [];
  const handle = createWhatsApp({
    config: { appSecret: "test" },
    store,
    createReport: () => {},
    ocr: async () => ({}),
    send: async (to, text) => {
      if (failing) throw new Error("temporary");
      sent.push(text);
    },
  });
  const message = {
    id: "retry-message",
    from: "test-phone",
    type: "text",
    text: { body: "VEG 150 MAIL" },
  };
  try {
    await assert.rejects(() => handle(message));
    assert.equal(
      store.db.prepare("SELECT state FROM messages WHERE id=?").get(message.id)
        .state,
      "delivery-failed",
    );
    failing = false;
    await handle(message);
    assert.equal(sent.length, 1);
    await handle(message);
    assert.equal(sent.length, 1);
  } finally {
    store.close();
  }
});
