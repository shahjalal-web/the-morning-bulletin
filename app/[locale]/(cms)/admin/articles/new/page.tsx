"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Suspense, useState } from "react";
import { ArticleEditor } from "@/components/cms/article-editor";
import { PageTitle } from "@/components/cms/shell";

type Choice = { locale: "bn" | "en"; translationOf?: string; format?: "gallery" };
const keyOf = (c: Choice) => `${c.locale}-${c.translationOf ?? ""}-${c.format ?? ""}`;

/** The full editor on one page; the draft is created on its first save. */
function NewArticle() {
  const t = useTranslations("cms");
  const uiLocale = useLocale() as "bn" | "en";
  const pathname = usePathname();
  const sp = useSearchParams();
  const requested = sp.get("locale");
  const source = sp.get("translationOf");
  const current: Choice = {
    locale: requested === "en" || requested === "bn" ? requested : uiLocale,
    translationOf: source && /^[a-f0-9]{24}$/.test(source) ? source : undefined,
    format: sp.get("format") === "gallery" ? "gallery" : undefined,
  };
  // After the first save the address becomes the story's own (/articles/<id>, without these
  // options). Keep the choices the page opened with, so the editor is not started afresh.
  const onNewPage = pathname.endsWith("/articles/new");
  const [kept, setKept] = useState(current);
  if (onNewPage && keyOf(kept) !== keyOf(current)) setKept(current);
  const choice = onNewPage ? current : kept;

  return (
    <>
      <PageTitle>{choice.format === "gallery" ? t("gallery.newTitle") : t("editor.newTitle")}</PageTitle>
      <ArticleEditor key={keyOf(choice)} newLocale={choice.locale} newFormat={choice.format} translationOf={choice.translationOf} />
    </>
  );
}

export default function NewArticlePage() {
  return (
    <div>
      <Suspense fallback={null}>
        <NewArticle />
      </Suspense>
    </div>
  );
}
