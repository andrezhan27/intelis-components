import { isSafePromotionUrl } from "../promotion-banner/safe-url.js";
import { promotionVariants } from "../promotion-banner/types.js";
import type {
  PromotionDraft,
  PromotionValidationErrors,
} from "./types.js";

export function validatePromotionDraft(
  draft: PromotionDraft,
): PromotionValidationErrors {
  const errors: PromotionValidationErrors = {};
  const message = draft.message.trim();
  const linkUrl = draft.linkUrl.trim();
  const linkText = draft.linkText.trim();

  if (!message) errors.message = "Message is required.";
  else if (message.length > 280)
    errors.message = "Message must be 280 characters or fewer.";

  if (linkUrl && !isSafePromotionUrl(linkUrl)) {
    errors.linkUrl = "Use a /relative-path or a valid https:// URL.";
  }

  if (linkText.length > 80) {
    errors.linkText = "CTA text must be 80 characters or fewer.";
  } else if (linkText && !linkUrl) {
    errors.linkText = "Add a link URL before adding CTA text.";
  }

  if (
    !(promotionVariants as readonly string[]).includes(draft.variant)
  ) {
    errors.variant = "Choose a supported variant.";
  }

  if (
    !Number.isInteger(draft.priority) ||
    draft.priority < -1000 ||
    draft.priority > 1000
  ) {
    errors.priority = "Priority must be an integer from -1000 to 1000.";
  }

  if (draft.startsAt && Number.isNaN(new Date(draft.startsAt).getTime())) {
    errors.startsAt = "Enter a valid start date and time.";
  }

  if (draft.endsAt && Number.isNaN(new Date(draft.endsAt).getTime())) {
    errors.endsAt = "Enter a valid end date and time.";
  }

  if (
    !errors.startsAt &&
    !errors.endsAt &&
    draft.startsAt &&
    draft.endsAt &&
    new Date(draft.endsAt) <= new Date(draft.startsAt)
  ) {
    errors.endsAt = "End must be later than start.";
  }

  return errors;
}
