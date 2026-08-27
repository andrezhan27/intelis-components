"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { promotionVariants } from "../promotion-banner/types.js";
import type { PromotionDraft, RestaurantPromotion } from "./types.js";
import { validatePromotionDraft } from "./validation.js";
import styles from "./promotion-manager.module.css";

const promotionColumns = [
  "id",
  "restaurant_id",
  "enabled",
  "message",
  "link_url",
  "link_text",
  "starts_at",
  "ends_at",
  "dismissible",
  "variant",
  "priority",
  "created_at",
  "updated_at",
].join(",");

const emptyDraft: PromotionDraft = {
  id: null,
  enabled: false,
  message: "",
  linkUrl: "",
  linkText: "",
  startsAt: "",
  endsAt: "",
  dismissible: false,
  variant: "default",
  priority: 0,
};

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function rowToDraft(row: RestaurantPromotion): PromotionDraft {
  return {
    id: row.id,
    enabled: row.enabled,
    message: row.message,
    linkUrl: row.link_url ?? "",
    linkText: row.link_text ?? "",
    startsAt: toLocalDateTime(row.starts_at),
    endsAt: toLocalDateTime(row.ends_at),
    dismissible: row.dismissible,
    variant: row.variant,
    priority: row.priority,
  };
}

function toTimestamp(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export type PromotionManagerProps = {
  supabase: SupabaseClient;
  restaurantId: string;
  className?: string;
  onSaved?: (restaurantId: string) => void | Promise<void>;
};

export function PromotionManager({
  supabase,
  restaurantId,
  className,
  onSaved,
}: PromotionManagerProps) {
  const [promotions, setPromotions] = useState<RestaurantPromotion[]>([]);
  const [draft, setDraft] = useState<PromotionDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const errors = useMemo(() => validatePromotionDraft(draft), [draft]);
  const canSave = !saving && Object.keys(errors).length === 0;

  const loadPromotions = useCallback(async () => {
    if (!restaurantId) {
      setPromotions([]);
      setDraft(emptyDraft);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    const { data, error: queryError } = await supabase
      .from("restaurant_promotions")
      .select(promotionColumns)
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setPromotions([]);
    } else {
      setPromotions((data ?? []) as unknown as RestaurantPromotion[]);
    }
    setLoading(false);
  }, [restaurantId, supabase]);

  useEffect(() => {
    setDraft(emptyDraft);
    setSuccess("");
    void loadPromotions();
  }, [loadPromotions]);

  function updateDraft<Key extends keyof PromotionDraft>(
    key: Key,
    value: PromotionDraft[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSuccess("");
  }

  async function savePromotion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || !restaurantId) return;

    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      restaurant_id: restaurantId,
      enabled: draft.enabled,
      message: draft.message.trim(),
      link_url: draft.linkUrl.trim() || null,
      link_text: draft.linkText.trim() || null,
      starts_at: toTimestamp(draft.startsAt),
      ends_at: toTimestamp(draft.endsAt),
      dismissible: draft.dismissible,
      variant: draft.variant,
      priority: draft.priority,
    };

    const mutation = draft.id
      ? supabase
          .from("restaurant_promotions")
          .update(payload)
          .eq("id", draft.id)
          .eq("restaurant_id", restaurantId)
      : supabase.from("restaurant_promotions").insert(payload);

    const { error: mutationError } = await mutation;
    if (mutationError) {
      setError(mutationError.message);
    } else {
      setSuccess(draft.id ? "Promotion updated." : "Promotion created.");
      setDraft(emptyDraft);
      await loadPromotions();
      await onSaved?.(restaurantId);
    }
    setSaving(false);
  }

  async function deletePromotion() {
    if (!draft.id || !restaurantId) return;
    if (!window.confirm("Delete this promotion? This cannot be undone.")) return;

    setSaving(true);
    setError("");
    const { error: mutationError } = await supabase
      .from("restaurant_promotions")
      .delete()
      .eq("id", draft.id)
      .eq("restaurant_id", restaurantId);

    if (mutationError) {
      setError(mutationError.message);
    } else {
      setDraft(emptyDraft);
      setSuccess("Promotion deleted.");
      await loadPromotions();
      await onSaved?.(restaurantId);
    }
    setSaving(false);
  }

  const rootClassName = className
    ? `${styles.manager} ${className}`
    : styles.manager;

  return (
    <section className={rootClassName} aria-label="Promotion management">
      <div className={styles.history}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Promotions</h2>
            <p>Schedule native banners for this restaurant website.</p>
          </div>
          <button type="button" onClick={() => setDraft(emptyDraft)}>
            New promotion
          </button>
        </div>

        {loading ? <p className={styles.muted}>Loading promotions…</p> : null}
        {!loading && promotions.length === 0 ? (
          <p className={styles.muted}>No promotions yet.</p>
        ) : null}
        <div className={styles.list}>
          {promotions.map((promotion) => (
            <button
              aria-pressed={draft.id === promotion.id}
              className={styles.historyItem}
              key={promotion.id}
              onClick={() => setDraft(rowToDraft(promotion))}
              type="button"
            >
              <span>{promotion.message}</span>
              <small>{promotion.enabled ? "Enabled" : "Disabled"}</small>
            </button>
          ))}
        </div>
      </div>

      <form className={styles.form} onSubmit={savePromotion}>
        <div className={styles.toggleRow}>
          <label>
            <input
              checked={draft.enabled}
              onChange={(event) => updateDraft("enabled", event.target.checked)}
              type="checkbox"
            />
            Enabled
          </label>
          <label>
            <input
              checked={draft.dismissible}
              onChange={(event) =>
                updateDraft("dismissible", event.target.checked)
              }
              type="checkbox"
            />
            Dismissible
          </label>
        </div>

        <label className={styles.field}>
          Message
          <textarea
            maxLength={280}
            onChange={(event) => updateDraft("message", event.target.value)}
            required
            rows={3}
            value={draft.message}
          />
          <small>{draft.message.trim().length}/280</small>
          {errors.message ? <em>{errors.message}</em> : null}
        </label>

        <div className={styles.twoColumns}>
          <label className={styles.field}>
            Link URL
            <input
              onChange={(event) => updateDraft("linkUrl", event.target.value)}
              placeholder="/offers or https://example.com"
              type="text"
              value={draft.linkUrl}
            />
            {errors.linkUrl ? <em>{errors.linkUrl}</em> : null}
          </label>
          <label className={styles.field}>
            CTA text
            <input
              maxLength={80}
              onChange={(event) => updateDraft("linkText", event.target.value)}
              placeholder="View offer"
              type="text"
              value={draft.linkText}
            />
            {errors.linkText ? <em>{errors.linkText}</em> : null}
          </label>
        </div>

        <div className={styles.twoColumns}>
          <label className={styles.field}>
            Starts at
            <input
              onChange={(event) => updateDraft("startsAt", event.target.value)}
              type="datetime-local"
              value={draft.startsAt}
            />
            {errors.startsAt ? <em>{errors.startsAt}</em> : null}
          </label>
          <label className={styles.field}>
            Ends at
            <input
              onChange={(event) => updateDraft("endsAt", event.target.value)}
              type="datetime-local"
              value={draft.endsAt}
            />
            {errors.endsAt ? <em>{errors.endsAt}</em> : null}
          </label>
        </div>
        <p className={styles.hint}>
          Times use this browser’s timezone. Active status is evaluated by the
          database using timezone-safe timestamps.
        </p>

        <div className={styles.twoColumns}>
          <label className={styles.field}>
            Variant
            <select
              onChange={(event) =>
                updateDraft(
                  "variant",
                  event.target.value as PromotionDraft["variant"],
                )
              }
              value={draft.variant}
            >
              {promotionVariants.map((variant) => (
                <option key={variant} value={variant}>
                  {variant}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Priority
            <input
              max={1000}
              min={-1000}
              onChange={(event) =>
                updateDraft("priority", Number(event.target.value))
              }
              step={1}
              type="number"
              value={draft.priority}
            />
            {errors.priority ? <em>{errors.priority}</em> : null}
          </label>
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}
        {success ? <p className={styles.success}>{success}</p> : null}

        <div className={styles.actions}>
          {draft.id ? (
            <button
              className={styles.deleteButton}
              disabled={saving}
              onClick={() => void deletePromotion()}
              type="button"
            >
              Delete
            </button>
          ) : null}
          <button
            className={styles.saveButton}
            disabled={!canSave}
            type="submit"
          >
            {saving ? "Saving…" : draft.id ? "Save changes" : "Create promotion"}
          </button>
        </div>
      </form>
    </section>
  );
}
