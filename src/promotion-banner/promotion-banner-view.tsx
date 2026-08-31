import type { PromotionBannerStyle, PromotionVariant, ScheduledPromotion } from "./types.js";
import styles from "./promotion-banner.module.css";

type PromotionBannerViewProps = {
  promotions: ScheduledPromotion[];
  activeIndex: number;
  backgroundVariant: PromotionVariant;
  ariaLabel: string;
  className?: string;
  style?: PromotionBannerStyle;
  automatic: boolean;
  paused: boolean;
  reducedMotion: boolean;
  onHover: (hovered: boolean) => void;
  onFocusWithin: (focused: boolean) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleRotation: () => void;
  onDismiss?: () => void;
};

export function PromotionBannerView({
  promotions, activeIndex, backgroundVariant, ariaLabel, className, style,
  automatic, paused, reducedMotion, onHover, onFocusWithin,
  onPrevious, onNext, onToggleRotation, onDismiss,
}: PromotionBannerViewProps) {
  const multiple = promotions.length > 1;
  return (
    <aside
      aria-label={ariaLabel}
      aria-roledescription={multiple ? "carousel" : undefined}
      className={className ? `${styles.banner} ${className}` : styles.banner}
      data-variant={backgroundVariant}
      role="region"
      style={style}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocusCapture={() => onFocusWithin(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onFocusWithin(false);
      }}
    >
      {multiple ? (
        <div className={styles.controls}>
          {!reducedMotion ? (
            <button className={styles.control} type="button"
              aria-label={paused ? "Resume promotion rotation" : "Pause promotion rotation"}
              onClick={onToggleRotation}>
              <span aria-hidden="true">{paused ? "▶" : "Ⅱ"}</span>
            </button>
          ) : null}
          <button className={styles.control} type="button" aria-label="Previous promotion" onClick={onPrevious}>
            <span aria-hidden="true">‹</span>
          </button>
          <span className={styles.position} aria-hidden="true">{activeIndex + 1} / {promotions.length}</span>
          <button className={styles.control} type="button" aria-label="Next promotion" onClick={onNext}>
            <span aria-hidden="true">›</span>
          </button>
        </div>
      ) : null}
      <div className={styles.slides} aria-live={automatic ? "off" : "polite"} aria-atomic="false">
        {promotions.map((promotion, index) => (
          <div
            key={promotion.id}
            className={styles.content}
            data-active={index === activeIndex}
            aria-hidden={index !== activeIndex}
            inert={index !== activeIndex}
            role={multiple ? "group" : undefined}
            aria-roledescription={multiple ? "slide" : undefined}
            aria-label={multiple ? `${index + 1} of ${promotions.length}` : undefined}
          >
            <span className={styles.message}>{promotion.message}</span>
            {promotion.linkUrl ? (
              <a className={styles.link} href={promotion.linkUrl} tabIndex={index === activeIndex ? undefined : -1}>
                {promotion.linkText ?? "Learn more"}
              </a>
            ) : null}
          </div>
        ))}
      </div>
      {promotions.some((promotion) => promotion.dismissible) ? (
        <button aria-label="Dismiss promotion" className={styles.dismiss} onClick={onDismiss} type="button"
          aria-hidden={!onDismiss} disabled={!onDismiss} style={{ visibility: onDismiss ? "visible" : "hidden" }}>
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
    </aside>
  );
}
