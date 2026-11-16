"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { useApi, type CmsCategory } from "@/components/cms/hooks";
import { can, ErrorNote, PageTitle, Panel } from "@/components/cms/shell";
import { useAuth } from "@/components/providers";
import { apiFetch, ApiError } from "@/lib/client-api";
import { paths } from "@/lib/urls";

type Loc = "bn" | "en";
const shown = (c: CmsCategory) => c.showInMenu !== false;
const arrow =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded border border-rule-strong bg-surface text-ink-2 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-30";

/** One row: place number, move buttons, a "jump to place" picker and the show-in-menu switch. */
function Row({
  c,
  pos,
  total,
  busy,
  lang,
  onMove,
  onToggle,
  extra,
}: {
  c: CmsCategory;
  pos: number;
  total: number;
  busy: boolean;
  lang: Loc;
  onMove: (to: number) => void;
  onToggle: () => void;
  extra?: ReactNode;
}) {
  const t = useTranslations("cms");
  const other: Loc = lang === "bn" ? "en" : "bn";
  return (
    <div className={`flex flex-col gap-2 py-2 sm:flex-row sm:items-center ${shown(c) ? "" : "opacity-60"}`}>
      {/* On phones the name has its own line and the controls sit below it. */}
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="w-7 shrink-0 text-right text-sm font-semibold tabular-nums text-muted">{pos + 1}.</span>
        <span className="min-w-0 wrap-break-word">
          <span lang={lang} className="font-semibold">
            {c.name[lang]}
          </span>{" "}
          <span lang={other} className="text-sm text-muted">
            · {c.name[other]}
          </span>
          {!shown(c) && <span className="ml-2 whitespace-nowrap rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted">{t("menuBar.hiddenBadge")}</span>}
          {extra && <span className="ml-2 whitespace-nowrap">{extra}</span>}
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-2 pl-9 sm:pl-0">
      <button type="button" className={arrow} disabled={busy || pos === 0} onClick={() => onMove(pos - 1)} aria-label={`${t("menuBar.up")}: ${c.name[lang]}`} title={t("menuBar.up")}>
        ↑
      </button>
      <button type="button" className={arrow} disabled={busy || pos === total - 1} onClick={() => onMove(pos + 1)} aria-label={`${t("menuBar.down")}: ${c.name[lang]}`} title={t("menuBar.down")}>
        ↓
      </button>
      <label className="flex items-center gap-1 text-sm">
        <span className="sr-only sm:not-sr-only">{t("menuBar.place")}</span>
        <select className="min-h-9 rounded border border-rule-strong bg-surface px-2" value={pos} disabled={busy} onChange={(e) => onMove(Number(e.target.value))} aria-label={`${t("menuBar.place")}: ${c.name[lang]}`}>
          {Array.from({ length: total }, (_, i) => (
            <option key={i} value={i}>
              {i + 1}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded border border-rule px-2 text-sm">
        <input type="checkbox" className="h-5 w-5" checked={shown(c)} disabled={busy} onChange={onToggle} />
        {t("menuBar.show")}
      </label>
      </span>
    </div>
  );
}

export default function MenuBarPage() {
  const t = useTranslations("cms");
  const locale = useLocale() as Loc;
  const { me } = useAuth();
  const manage = can(me, "taxonomy:manage");
  const cats = useApi<{ data: CmsCategory[] }>("/admin/categories");
  const [lang, setLang] = useState<Loc>(locale);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Only live sections can be in the menu; hidden (inactive) ones are managed in Sections & tags.
  const all = (cats.data?.data ?? []).filter((c) => c.isActive);
  const top = all.filter((c) => !c.parent);
  const childrenOf = (id: string) => all.filter((c) => c.parent === id);
  const inactive = (cats.data?.data ?? []).length - all.length;

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await work();
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      await cats.reload();
      setBusy(false);
    }
  };

  /** Moves a section to a new place among its siblings; the list updates at once and is saved. */
  const move = (list: CmsCategory[], from: number, to: number) => {
    if (to < 0 || to >= list.length || to === from) return;
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    const rank = new Map(next.map((c, i) => [c.id, (i + 1) * 10]));
    cats.setData((d) => (d ? { data: d.data.map((c) => (rank.has(c.id) ? { ...c, order: rank.get(c.id)! } : c)).sort((a, b) => a.order - b.order) } : d));
    void run(() => apiFetch("/admin/categories/order", { method: "PUT", body: { ids: next.map((c) => c.id) } }));
  };
  const toggle = (c: CmsCategory) => {
    cats.setData((d) => (d ? { data: d.data.map((x) => (x.id === c.id ? { ...x, showInMenu: !shown(c) } : x)) } : d));
    void run(() => apiFetch(`/admin/categories/${c.id}`, { method: "PATCH", body: { showInMenu: !shown(c) } }));
  };

  const preview = top.filter(shown);

  return (
    <div className="space-y-6">
      <PageTitle>{t("nav.menuBar")}</PageTitle>
      <p className="max-w-3xl text-ink-2">{t("menuBar.intro")}</p>

      <Panel
        title={t("menuBar.preview")}
        actions={
          <div role="group" aria-label={t("menuBar.previewLang")} className="flex overflow-hidden rounded border border-rule-strong text-sm">
            {(["bn", "en"] as const).map((l) => (
              <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} className={`min-h-9 px-3 ${lang === l ? "bg-brand font-semibold text-brand-ink" : "hover:bg-surface-2"}`}>
                {l === "bn" ? "বাংলা" : "English"}
              </button>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto rounded border border-rule bg-paper">
          <ul lang={lang} className="flex min-w-max flex-wrap gap-1 p-2 text-[0.9375rem] lg:min-w-0">
            <li className="rounded px-3 py-2 font-semibold">{lang === "bn" ? "সর্বশেষ" : "Latest"}</li>
            {preview.map((c) => {
              const subs = childrenOf(c.id).filter(shown);
              return (
                <li key={c.id} className="flex items-center gap-1 rounded px-3 py-2">
                  {c.name[lang]}
                  {subs.length > 0 && (
                    <span aria-hidden="true" className="text-xs text-muted">
                      ▾
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <p className="mt-2 text-xs text-muted">{t("menuBar.previewNote")}</p>
      </Panel>

      <Panel title={t("menuBar.arrange")}>
        <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-ink-2">
          <li>{t("menuBar.how1")}</li>
          <li>{t("menuBar.how2")}</li>
          <li>{t("menuBar.how3")}</li>
        </ul>
        <div aria-live="polite" className="min-h-6 text-sm">
          {busy ? <span className="text-muted">{t("menuBar.saving")}</span> : saved ? <span className="font-semibold text-brand">✓ {t("menuBar.saved")}</span> : null}
        </div>
        <ErrorNote message={error} />
        {!manage && <p className="text-sm text-muted">{t("menuBar.readOnly")}</p>}
        {cats.loading && !cats.data ? (
          <div className="skeleton h-64" aria-hidden="true" />
        ) : (
          <fieldset disabled={!manage} className="min-w-0">
            <ol className="divide-y divide-rule">
              {top.map((c, i) => {
                const subs = childrenOf(c.id);
                const expanded = open === c.id;
                return (
                  <li key={c.id}>
                    <Row
                      c={c}
                      pos={i}
                      total={top.length}
                      busy={busy}
                      lang={lang}
                      onMove={(to) => move(top, i, to)}
                      onToggle={() => toggle(c)}
                      extra={
                        subs.length > 0 && (
                          <button type="button" className="text-sm text-link underline" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : c.id)}>
                            {t("menuBar.subsections", { count: subs.length })} {expanded ? "▴" : "▾"}
                          </button>
                        )
                      }
                    />
                    {expanded && (
                      <div className="mb-3 ml-4 rounded border-l-4 border-rule-strong bg-paper pl-2 sm:ml-12">
                        <p className="pt-2 text-xs text-muted">{t("menuBar.subHint", { name: c.name[lang] })}</p>
                        <ol className="divide-y divide-rule">
                          {subs.map((s, j) => (
                            <li key={s.id}>
                              <Row c={s} pos={j} total={subs.length} busy={busy} lang={lang} onMove={(to) => move(subs, j, to)} onToggle={() => toggle(s)} />
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </fieldset>
        )}
        <p className="mt-4 text-sm text-muted">
          {inactive > 0 && <>{t("menuBar.inactive", { count: inactive })} </>}
          {t("menuBar.addNote")}{" "}
          <Link href={paths.admin(locale, "taxonomy")} className="text-link underline">
            {t("nav.taxonomy")}
          </Link>
        </p>
      </Panel>
    </div>
  );
}
