"use client";

/* eslint-disable @next/next/no-img-element -- CMS thumbnails come from arbitrary media URLs */
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import type { CmsMedia } from "./hooks";
import { MediaPicker } from "./media-picker";
import { btn, btnPrimary, field } from "./shell";
import { uploadImage } from "./upload";

export interface GalleryItem {
  media: string;
  caption: string;
  credit: string;
}

const small = "flex h-9 w-9 shrink-0 items-center justify-center rounded border border-rule-strong bg-surface text-ink-2 hover:bg-surface-2 disabled:opacity-30";

/**
 * Photos of a gallery story: upload several at once or pick from the library, write a
 * description and credit for each, and put them in order. Readers see them in a carousel.
 */
export function GalleryEditor({
  items,
  onChange,
  editable,
  lang,
  onError,
}: {
  items: GalleryItem[];
  onChange: (items: GalleryItem[]) => void;
  editable: boolean;
  lang: "bn" | "en";
  onError: (message: string) => void;
}) {
  const t = useTranslations("cms");
  const [known, setKnown] = useState<Map<string, CmsMedia>>(new Map());
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Thumbnails for photos saved earlier.
  const missing = items.map((i) => i.media).filter((id) => !known.has(id));
  const missingKey = missing.join(",");
  useEffect(() => {
    if (!missingKey) return;
    let alive = true;
    Promise.all(missingKey.split(",").map((id) => apiFetch<{ data: CmsMedia }>(`/admin/media/${id}`).then((r) => r.data).catch(() => null))).then((found) => {
      if (!alive) return;
      setKnown((m) => {
        const next = new Map(m);
        for (const f of found) if (f) next.set(f.id, f);
        return next;
      });
    });
    return () => {
      alive = false;
    };
  }, [missingKey]);

  const remember = (m: CmsMedia) => setKnown((k) => new Map(k).set(m.id, m));
  const add = (list: GalleryItem[], m: CmsMedia) =>
    list.some((i) => i.media === m.id) ? list : [...list, { media: m.id, caption: m.caption?.[lang] ?? "", credit: m.credit ?? "" }];
  const set = (i: number, patch: Partial<GalleryItem>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const move = (i: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [it] = next.splice(i, 1);
    next.splice(to, 0, it!);
    onChange(next);
  };

  return (
    <div>
      <p className="text-sm text-muted">{t("gallery.help")}</p>
      {items.length === 0 && <p className="mt-3 rounded border border-dashed border-rule-strong p-4 text-center text-sm text-muted">{t("gallery.empty")}</p>}
      <ol className="mt-3 space-y-3">
        {items.map((it, i) => {
          const m = known.get(it.media);
          return (
            <li key={it.media} className="rounded border border-rule bg-paper p-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative w-full shrink-0 sm:w-44">
                  <span className="absolute left-1 top-1 rounded bg-black/70 px-2 py-0.5 text-xs font-semibold text-white">{i + 1}</span>
                  {m ? (
                    <img src={m.url} alt="" className="aspect-[4/3] w-full rounded object-cover" style={{ objectPosition: `${m.focalX}% ${m.focalY}%` }} />
                  ) : (
                    <div className="skeleton aspect-[4/3] w-full rounded" aria-hidden="true" />
                  )}
                  {editable && (
                    <div className="mt-2 flex gap-1">
                      <button type="button" className={small} disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`${t("gallery.up")} (${i + 1})`} title={t("gallery.up")}>
                        ↑
                      </button>
                      <button type="button" className={small} disabled={i === items.length - 1} onClick={() => move(i, i + 1)} aria-label={`${t("gallery.down")} (${i + 1})`} title={t("gallery.down")}>
                        ↓
                      </button>
                      <button
                        type="button"
                        className={`${small} ml-auto border-breaking text-breaking`}
                        onClick={() => onChange(items.filter((_, j) => j !== i))}
                        aria-label={`${t("gallery.remove")} (${i + 1})`}
                        title={t("gallery.remove")}
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <label className="block text-sm font-semibold">
                    {t("gallery.caption", { n: i + 1 })}
                    <textarea
                      lang={lang}
                      value={it.caption}
                      onChange={(e) => set(i, { caption: e.target.value })}
                      readOnly={!editable}
                      maxLength={1000}
                      rows={3}
                      className={`${field} py-2 font-normal`}
                      placeholder={t("gallery.captionPlaceholder")}
                    />
                  </label>
                  <label className="block text-sm">
                    {t("gallery.credit")}
                    <input lang={lang} value={it.credit} onChange={(e) => set(i, { credit: e.target.value })} readOnly={!editable} maxLength={200} className={field} placeholder={t("gallery.creditPlaceholder")} />
                  </label>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {editable && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className={`${btnPrimary} cursor-pointer has-[:focus-visible]:outline-2 ${uploading ? "pointer-events-none opacity-50" : ""}`}>
            {uploading ? t("gallery.uploading", { done: uploading.done, total: uploading.total }) : `+ ${t("gallery.upload")}`}
            <input
              type="file"
              multiple
              className="sr-only"
              disabled={Boolean(uploading)}
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
              onChange={async (e) => {
                const files = [...(e.target.files ?? [])];
                e.target.value = "";
                if (!files.length) return;
                let list = items;
                setUploading({ done: 0, total: files.length });
                let failed = 0;
                for (const [n, file] of files.entries()) {
                  try {
                    const media = await uploadImage(file);
                    remember(media);
                    list = add(list, media);
                    onChange(list);
                  } catch {
                    failed++;
                  }
                  setUploading({ done: n + 1, total: files.length });
                }
                setUploading(null);
                if (failed) onError(t("gallery.someFailed", { count: failed }));
              }}
            />
          </label>
          <button type="button" className={btn} onClick={() => setPickerOpen(true)}>
            {t("gallery.fromLibrary")}
          </button>
          <span className="text-sm text-muted">{t("gallery.count", { count: items.length })}</span>
        </div>
      )}
      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(m) => {
          remember(m);
          onChange(add(items, m));
        }}
      />
    </div>
  );
}
