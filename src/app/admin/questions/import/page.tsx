"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { FileUp, Download } from "lucide-react";
import { Alert, Button, Card, CardBody, CardHeader, Textarea } from "@/components/ui";
import { apiJson, errorMessage } from "@/components/admin/api";

const TEMPLATE = [
  "subject,difficulty,type,text,option1,option2,option3,option4,correct,explanation,source,license,topic",
  'quantitative-aptitude,EASY,single,"What is 15% of 200?",20,25,30,35,3,"15% of 200 = 30.","Author-written for RankForge","Original content",Percentages',
].join("\n");

type ImportResult = { imported: number; failed: number; errors: Array<{ row: number; message: string }> };

export default function ImportQuestionsPage() {
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    setResult(null);
    setError(null);
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "rankforge-question-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await apiJson<ImportResult>("/api/admin/questions/import", {
        method: "POST",
        body: JSON.stringify({ csv }),
      });
      setResult(response);
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink-950 dark:text-ink-50">Import questions from CSV</h1>
        <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
          Imported rows become drafts. Invalid rows are reported and nothing is partially inserted.
        </p>
      </div>

      {error ? <Alert tone="danger" title="Import failed">{error}</Alert> : null}
      {result ? (
        <Alert
          tone={result.failed > 0 ? "warn" : "success"}
          title={`${result.imported} question(s) imported, ${result.failed} row(s) rejected`}
        >
          {result.errors.length > 0 ? (
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {result.errors.map((item) => (
                <li key={item.row}>
                  Row {item.row}: {item.message}
                </li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title="CSV content"
          description="Header must be: subject,difficulty,type,text,option1..option4,correct,explanation,source,license,topic"
          action={
            <Button variant="secondary" size="sm" onClick={downloadTemplate}>
              <Download className="h-3.5 w-3.5" aria-hidden />
              Download template
            </Button>
          }
        />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
            />
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              <FileUp className="h-3.5 w-3.5" aria-hidden />
              Choose CSV file
            </Button>
            <span className="text-xs text-ink-500 dark:text-ink-400">…or paste the CSV below.</span>
          </div>
          <Textarea
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            className="min-h-64 font-mono text-xs"
            placeholder={TEMPLATE}
            spellCheck={false}
            aria-label="CSV content"
          />
          <p className="text-xs text-ink-500 dark:text-ink-400">
            <strong>correct</strong> is a 1-based option number (or comma-separated list for multi-select).{" "}
            <strong>topic</strong> is optional and created automatically on first use. Subjects are matched by slug or
            name.
          </p>
        </CardBody>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Link href="/admin/questions" className="text-sm text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100">
          Back to question bank
        </Link>
        <Button loading={busy} disabled={csv.trim().length < 10} onClick={() => void submit()}>
          Import questions
        </Button>
      </div>
    </div>
  );
}
