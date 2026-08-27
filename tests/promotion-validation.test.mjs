import assert from "node:assert/strict";
import test from "node:test";

import { validatePromotionDraft } from "../dist/dashboard/validation.js";

const validDraft = {
  id: null,
  enabled: true,
  message: "Summer menu is here",
  linkUrl: "/menu",
  linkText: "View menu",
  startsAt: "2026-08-27T12:00",
  endsAt: "2026-08-28T12:00",
  dismissible: true,
  variant: "announcement",
  priority: 10,
};

test("accepts a valid promotion draft", () => {
  assert.deepEqual(validatePromotionDraft(validDraft), {});
});

test("validates message, URL, dates, CTA, and priority", () => {
  const errors = validatePromotionDraft({
    ...validDraft,
    message: " ",
    linkUrl: "javascript:alert(1)",
    linkText: "x".repeat(81),
    endsAt: "2026-08-27T11:59",
    priority: 1001,
  });

  assert.ok(errors.message);
  assert.ok(errors.linkUrl);
  assert.ok(errors.linkText);
  assert.ok(errors.endsAt);
  assert.ok(errors.priority);
});
