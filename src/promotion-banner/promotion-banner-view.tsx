import type { MouseEventHandler } from "react";
import type { ActivePromotion, PromotionBannerStyle } from "./types.js";
import styles from "./promotion-banner.module.css";

type PromotionBannerViewProps = {
  promotion: ActivePromotion;
  ariaLabel: string;
  className?: string;
  style?: PromotionBannerStyle;
  onDismiss?: MouseEventHandler<HTMLButtonElement>;
};

export function PromotionBannerView({
  promotion,
  ariaLabel,
  className,
  style,
  onDismiss,
}: PromotionBannerViewProps) {
  const classes = className ? `${styles.banner} ${className}` : styles.banner;

  return (
    <aside
      aria-label={ariaLabel}
      className={classes}
      data-variant={promotion.variant}
      role="region"
      style={style}
    >
      <div className={styles.content}>
        <span className={styles.message}>{promotion.message}</span>
        {promotion.linkUrl ? (
          <a className={styles.link} href={promotion.linkUrl}>
            {promotion.linkText ?? "Learn more"}
          </a>
        ) : null}
      </div>
      {onDismiss ? (
        <button
          aria-label="Dismiss promotion"
          className={styles.dismiss}
          onClick={onDismiss}
          type="button"
        >
          <span aria-hidden>×</span>
        </button>
      ) : null}
    </aside>
  );
}
