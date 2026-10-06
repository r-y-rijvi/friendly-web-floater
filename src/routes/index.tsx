import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  computeStatus,
  isBlocking,
  sha256Hex,
  type DocStatus,
  type Requirement,
  type RequirementsFile,
  type UploadedFile,
} from "@/lib/tender";
import { buildPackagePdf } from "@/lib/packagePdf";
import { t, type Lang, type StringKey } from "@/lib/i18n";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tender Package Builder" },
      {
        name: "description",
        content:
          "Turn a set of PDF files into one complete, checked and correctly ordered tender submission package — entirely in your browser.",
      },
      { property: "og:title", content: "Tender Package Builder" },
      {
        property: "og:description",
        content:
          "Turn a set of PDF files into one complete, checked and correctly ordered tender submission package — entirely in your browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const MAX_FILES = 30;
const MAX_BYTES = 50 * 1024 * 1024;

const statusStyles: Record<DocStatus, string> = {
  missing: "bg-destructive/10 text-destructive border-destructive/30",
  expiry_needed: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  expired: "bg-destructive/10 text-destructive border-destructive/30",
  not_provided: "bg-muted text-muted-foreground border-border",
  ok: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function Index() {
  const [lang, setLang] = useState<Lang>("en");
  const [reqFile, setReqFile] = useState<RequirementsFile | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [matches, setMatches] = useState<Record<string, string>>({}); // reqId -> fileId
  const [expiries, setExpiries] = useState<Record<string, string>>({}); // reqId -> date
  const [messages, setMessages] = useState<string[]>([]);
  const [includeIndex, setIncludeIndex] = useState(true);
  const [generating, setGenerating] = useState(false);
  const reqInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const tr = (k: StringKey) => t(lang, k);

  const requirements = useMemo<Requirement[]>(
    () => (reqFile ? [...reqFile.requirements].sort((a, b) => a.order - b.order) : []),
    [reqFile]
  );

  const fileById = useMemo(() => new Map(files.map((f) => [f.id, f])), [files]);

  // duplicate groups by content hash
  const dupByHash = useMemo(() => {
    const map = new Map<string, UploadedFile[]>();
    for (const f of files) {
      const arr = map.get(f.hash) ?? [];
      arr.push(f);
      map.set(f.hash, arr);
    }
    return map;
  }, [files]);

  const matchedFileIds = new Set(Object.values(matches));

  const statuses = useMemo(() => {
    if (!reqFile) return new Map<string, DocStatus>();
    const m = new Map<string, DocStatus>();
    for (const r of requirements) {
      const fid = matches[r.id];
      const f = fid ? fileById.get(fid) : undefined;
      m.set(r.id, computeStatus(r, f, expiries[r.id], reqFile.tender.submission_deadline));
    }
    return m;
  }, [reqFile, requirements, matches, expiries, fileById]);

  const blockers = requirements.filter((r) => isBlocking(statuses.get(r.id) ?? "missing"));
  const canGenerate = !!reqFile && blockers.length === 0 && files.length > 0;

  async function onRequirementsPicked(fileList: FileList | null) {
    const f = fileList?.[0];
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text()) as RequirementsFile;
      if (!parsed.tender?.tender_id || !Array.isArray(parsed.requirements)) {
        throw new Error("bad shape");
      }
      setReqFile(parsed);
      setMatches({});
      setExpiries({});
      setMessages([]);
    } catch {
      setMessages((m) => [...m, tr("invalidJson")]);
    }
    if (reqInputRef.current) reqInputRef.current.value = "";
  }

  async function onPdfsPicked(fileList: FileList | null) {
    if (!fileList) return;
    const incoming = Array.from(fileList);
    const newMessages: string[] = [];
    const current = [...files];
    let totalBytes = current.reduce((s, f) => s + f.size, 0);

    for (const f of incoming) {
      if (current.length >= MAX_FILES) {
        newMessages.push(tr("tooMany"));
        break;
      }
      const isPdf =
        f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        newMessages.push(`${f.name} ${tr("notPdf")}`);
        continue;
      }
      if (totalBytes + f.size > MAX_BYTES) {
        newMessages.push(tr("tooBig"));
        break;
      }
      const bytes = await f.arrayBuffer();
      const hash = await sha256Hex(bytes);
      const entry: UploadedFile = {
        id: uid(),
        name: f.name,
        size: f.size,
        pages: null,
        bytes,
        hash,
      };
      current.push(entry);
      totalBytes += f.size;
      // count pages; mark damaged/protected files
      try {
        const task = pdfjs.getDocument({ data: bytes.slice(0) });
        const doc = await task.promise;
        entry.pages = doc.numPages;
        await task.destroy();
      } catch {
        entry.pages = 0;
        entry.error = tr("badFile");
      }
    }
    setFiles(current);
    if (newMessages.length) setMessages((m) => [...m, ...newMessages]);
    if (pdfInputRef.current) pdfInputRef.current.value = "";
  }

  function removeFile(id: string) {
    setFiles((fs) => fs.filter((f) => f.id !== id));
    setMatches((m) => {
      const next = { ...m };
      for (const [k, v] of Object.entries(next)) if (v === id) delete next[k];
      return next;
    });
  }

  function setMatch(reqId: string, fileId: string) {
    setMatches((m) => {
      const next = { ...m };
      if (!fileId) {
        delete next[reqId];
        return next;
      }
      // one file -> at most one document
      for (const [k, v] of Object.entries(next)) if (v === fileId) delete next[k];
      next[reqId] = fileId;
      return next;
    });
  }

  async function generate() {
    if (!reqFile || !canGenerate) return;
    setGenerating(true);
    try {
      const entries = requirements
        .filter((r) => matches[r.id])
        .map((r) => ({ req: r, file: fileById.get(matches[r.id]!)! }))
        .filter((e) => e.file && !e.file.error);
      const bytes = await buildPackagePdf({
        tender: reqFile.tender,
        entries,
        includeIndex,
        generatedOn: new Date().toISOString().slice(0, 10),
      });
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reqFile.tender.tender_id}_Package.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-5">
          <div>
            <h1 className="text-xl font-bold text-foreground">{tr("appTitle")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{tr("appSubtitle")}</p>
          </div>
          <div className="flex rounded-md border border-border">
            {(["en", "bn"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-3 py-1.5 text-sm font-medium ${
                  lang === l
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                } ${l === "en" ? "rounded-l-md" : "rounded-r-md"}`}
              >
                {l === "en" ? "English" : "বাংলা"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {messages.length > 0 && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {messages.map((m, i) => (
              <p key={i}>{m}</p>
            ))}
          </div>
        )}

        {/* Step 1 */}
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-semibold text-foreground">{tr("step1")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{tr("step1Hint")}</p>
          <input
            ref={reqInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => onRequirementsPicked(e.target.files)}
          />
          <button
            onClick={() => reqInputRef.current?.click()}
            className="mt-3 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            {tr("chooseFile")}
          </button>

          {reqFile && (
            <div className="mt-4 rounded-md border border-border bg-background p-4">
              <h3 className="text-sm font-semibold text-foreground">{tr("tenderDetails")}</h3>
              <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">{tr("tenderId")}:</dt>
                  <dd className="font-medium text-foreground">{reqFile.tender.tender_id}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">{tr("title")}:</dt>
                  <dd className="font-medium text-foreground">{reqFile.tender.title}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">{tr("procuringEntity")}:</dt>
                  <dd className="font-medium text-foreground">{reqFile.tender.procuring_entity}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">{tr("bidder")}:</dt>
                  <dd className="font-medium text-foreground">{reqFile.tender.bidder}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">{tr("deadline")}:</dt>
                  <dd className="font-medium text-foreground">{reqFile.tender.submission_deadline}</dd>
                </div>
              </dl>
            </div>
          )}
        </section>

        {/* Step 2 */}
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-semibold text-foreground">{tr("step2")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{tr("step2Hint")}</p>
          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => onPdfsPicked(e.target.files)}
          />
          <button
            onClick={() => pdfInputRef.current?.click()}
            className="mt-3 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            {tr("addPdfs")}
          </button>

          <div className="mt-4">
            <h3 className="text-sm font-semibold text-foreground">
              {tr("uploadedFiles")} ({files.length})
            </h3>
            {files.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{tr("noFiles")}</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {files.map((f) => {
                  const dups = (dupByHash.get(f.hash) ?? []).filter((d) => d.id !== f.id);
                  return (
                    <li
                      key={f.id}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-foreground">{f.name}</span>
                      <span className="text-muted-foreground">
                        {f.pages === null ? "…" : `${f.pages} ${tr("pages")}`}
                      </span>
                      {dups.length > 0 && (
                        <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700">
                          {tr("duplicate")} · {tr("duplicateOf")} {dups.map((d) => d.name).join(", ")}
                        </span>
                      )}
                      {f.error && (
                        <span className="rounded border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                          {f.error}
                        </span>
                      )}
                      <button
                        onClick={() => removeFile(f.id)}
                        className="ml-auto text-xs font-medium text-destructive hover:underline"
                      >
                        {tr("remove")}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Step 3 */}
        {reqFile && (
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-semibold text-foreground">{tr("step3")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{tr("step3Hint")}</p>
            <ul className="mt-4 space-y-3">
              {requirements.map((r) => {
                const status = statuses.get(r.id) ?? "missing";
                const matchedId = matches[r.id] ?? "";
                // duplicates: files sharing a hash can't be matched to different docs
                const matchedHash = matchedId ? fileById.get(matchedId)?.hash : undefined;
                const selectable = files.filter((f) => {
                  if (f.error) return false;
                  if (!matchedFileIds.has(f.id)) {
                    // block if a same-content file is matched to another doc
                    if (matchedHash && f.hash === matchedHash && f.id !== matchedId) return false;
                    return true;
                  }
                  return f.id === matchedId;
                });
                return (
                  <li
                    key={r.id}
                    className="rounded-md border border-border bg-background p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">
                        {String(r.order).padStart(2, "0")}
                      </span>
                      <span className="font-medium text-foreground">
                        {lang === "bn" && r.title_bn ? r.title_bn : r.title_en}
                      </span>
                      <span className="rounded border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {r.mandatory ? tr("mandatory") : tr("optional")}
                      </span>
                      <span
                        className={`ml-auto rounded border px-2 py-0.5 text-xs font-medium ${statusStyles[status]}`}
                      >
                        {tr(`status_${status}` as StringKey)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <select
                        value={matchedId}
                        onChange={(e) => setMatch(r.id, e.target.value)}
                        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                      >
                        <option value="">{tr("none")}</option>
                        {selectable.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                      {r.has_expiry && matchedId && (
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          {tr("expiryDate")}:
                          <input
                            type="date"
                            value={expiries[r.id] ?? ""}
                            onChange={(e) =>
                              setExpiries((x) => ({ ...x, [r.id]: e.target.value }))
                            }
                            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                          />
                        </label>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Step 4 */}
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-semibold text-foreground">{tr("step4")}</h2>
          {!reqFile ? (
            <p className="mt-2 text-sm text-muted-foreground">{tr("loadFirst")}</p>
          ) : blockers.length > 0 ? (
            <div className="mt-2 text-sm">
              <p className="font-medium text-destructive">{tr("blockedBecause")}</p>
              <ul className="mt-1 list-inside list-disc text-muted-foreground">
                {blockers.map((r) => (
                  <li key={r.id}>
                    {lang === "bn" && r.title_bn ? r.title_bn : r.title_en} —{" "}
                    {tr(`status_${statuses.get(r.id)}` as StringKey)}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-2 text-sm text-emerald-700">{tr("ready")}</p>
          )}
          <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={includeIndex}
              onChange={(e) => setIncludeIndex(e.target.checked)}
            />
            {tr("includeIndex")}
          </label>
          <button
            onClick={generate}
            disabled={!canGenerate || generating}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? tr("generating") : tr("generate")}
          </button>
        </section>
      </main>
    </div>
  );
}
