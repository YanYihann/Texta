import fs from "node:fs";
import path from "node:path";
import { PageFrame } from "./provider";
import { Footer, SimpleHeader } from "./shared";
export function LegalPage({
  policy,
}: {
  policy: "privacy" | "terms" | "refund";
}) {
  // Only trusted, version-controlled policy copy is read at build time; no legacy page runtime is shipped.
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "../public", `${policy}.html`),
    "utf8",
  );
  const match = source.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (!match) throw Error(`Missing policy: ${policy}`);
  const html = match[1].replace(
    /\.\/(terms|privacy|refund|app|pay|index)\.html/g,
    (_, route: string) => (route === "index" ? "/" : `/${route}/`),
  );
  return (
    <PageFrame
      kind="legal"
      title={
        { privacy: "隐私政策", terms: "服务条款", refund: "退款政策" }[policy]
      }
    >
      <SimpleHeader />
      <main
        className="legal-shell"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <Footer />
    </PageFrame>
  );
}
