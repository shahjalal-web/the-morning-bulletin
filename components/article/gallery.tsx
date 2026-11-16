"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Image as Img } from "@/lib/types";

/**
 * Photo gallery carousel: one photo at a time with its own description and credit.
 * Swipe or scroll on touch screens (CSS scroll snapping), arrows and thumbnails with a
 * mouse, and the left/right keys once the gallery has focus. Every photo and caption is in
 * the server HTML, so the story is complete without JavaScript and in print.
 */
export function GalleryCarousel({ images, title }: { images: Img[]; title: string }) {
  const t = useTranslations("article");
  const locale = useLocale();
  const track = useRef<HTMLDivElement>(null);
  const thumbs = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const num = (n: number) => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-GB").format(n);
  const total = images.length;

  const go = useCallback(
    (i: number) => {
      const el = track.current;
      if (!el) return;
      const next = Math.max(0, Math.min(total - 1, i));
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    },
    [total],
  );

  // The current photo follows the scroll position (swipes, arrows, thumbnails alike).
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Keep the current thumbnail in view.
  useEffect(() => {
    const strip = thumbs.current;
    const item = strip?.children[index] as HTMLElement | undefined;
    if (strip && item) strip.scrollTo({ left: item.offsetLeft - strip.clientWidth / 2 + item.clientWidth / 2, behavior: "smooth" });
  }, [index]);

  const arrow =
    "no-print absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-2xl leading-none text-white hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-0";

  return (
    <section aria-roledescription="carousel" aria-label={t("galleryLabel", { title })} className="mt-5">
      <div className="relative">
        <div
          ref={track}
          tabIndex={0}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth scrollbar-none focus-visible:outline-2 focus-visible:outline-offset-2 print:block print:overflow-visible"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault();
              go(index + 1);
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              go(index - 1);
            }
          }}
        >
          {images.map((img, i) => (
            <figure
              key={`${img.id}-${i}`}
              role="group"
              aria-roledescription="slide"
              aria-label={t("slideOf", { n: num(i + 1), total: num(total) })}
              // Phones: description on top, photo below (photos line up at the bottom so the
              // thumbnails sit right under them). Wider screens: description left, photo right.
              className="flex w-full shrink-0 snap-center flex-col justify-end md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)] md:items-center md:gap-6 print:mb-6"
            >
              {(img.caption || img.credit) && (
                <figcaption className="pb-3 text-[0.9375rem] leading-relaxed text-ink-2 md:pb-0">
                  {img.caption}
                  {img.credit && <span className="ml-1 text-sm text-muted">{t("photoBy", { credit: img.credit })}</span>}
                </figcaption>
              )}
              <div className="relative aspect-[3/2] w-full overflow-hidden bg-[#111] md:col-start-2">
                <Image
                  src={img.url}
                  alt={img.alt || img.caption || ""}
                  fill
                  sizes="(min-width: 1280px) 860px, (min-width: 1024px) 66vw, 100vw"
                  preload={i === 0}
                  loading={i === 0 ? "eager" : "lazy"}
                  quality={75}
                  style={{ objectFit: "contain" }}
                />
                <span className="absolute right-2 top-2 rounded bg-black/70 px-2 py-0.5 text-sm font-semibold text-white tabular-nums">
                  {num(i + 1)} / {num(total)}
                </span>
                {/* Arrows sit on each photo; only the visible slide's arrows can take focus. */}
                {total > 1 && (
                  <>
                    <button type="button" tabIndex={i === index ? 0 : -1} aria-hidden={i !== index} className={`${arrow} left-2`} onClick={() => go(i - 1)} disabled={i === 0} aria-label={t("prevPhoto")}>
                      ‹
                    </button>
                    <button type="button" tabIndex={i === index ? 0 : -1} aria-hidden={i !== index} className={`${arrow} right-2`} onClick={() => go(i + 1)} disabled={i === total - 1} aria-label={t("nextPhoto")}>
                      ›
                    </button>
                  </>
                )}
              </div>
            </figure>
          ))}
        </div>
      </div>
      {total > 1 && (
        <div ref={thumbs} className="no-print mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none md:ml-[calc((100%-1.5rem)/3.4+1.5rem)]" aria-label={t("thumbnails")} role="group">
          {images.map((img, i) => (
            <button
              key={`${img.id}-${i}`}
              type="button"
              onClick={() => go(i)}
              aria-label={t("slideOf", { n: num(i + 1), total: num(total) })}
              aria-current={i === index}
              className={`relative h-14 w-20 shrink-0 overflow-hidden rounded border-2 sm:h-16 sm:w-24 ${i === index ? "border-brand" : "border-transparent opacity-70 hover:opacity-100"}`}
            >
              <Image src={img.url} alt="" fill sizes="96px" quality={50} style={{ objectFit: "cover", objectPosition: `${img.focalX}% ${img.focalY}%` }} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
