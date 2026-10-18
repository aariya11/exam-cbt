import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertSameOrigin, handle, ok, readJson, requireRole } from "@/lib/api";
import { ROLES } from "@/lib/constants";
import { badRequest, unprocessable } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/rate-limit";

// Bulk CSV import.
//
// Header (exact):
//   subject,difficulty,type,text,option1,option2,option3,option4,correct,explanation,source,license,topic
//   - difficulty: EASY | MEDIUM | HARD
//   - type: single | multiple (default single)
//   - correct: 1-based option number, or comma-separated list for multiple
//   - topic: optional topic name (created on first use, matched case-insensitively)
//
// Valid rows are imported as DRAFT with an audit record; invalid rows are
// reported individually and never partially inserted.

const importSchema = z.object({ csv: z.string().min(10).max(2_000_000) });

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const auth = await requireRole(req, ROLES.QUESTION_EDITOR);
  enforceRateLimit(`import:${auth.user.id}`, 10, 10 * 60 * 1000);

  const { csv } = await readJson(req, importSchema);
  const rows = parseCsv(csv);
  if (rows.length === 0) throw badRequest("The CSV file is empty.");

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const required = ["subject", "difficulty", "text", "option1", "option2", "correct"];
  for (const column of required) {
    if (!header.includes(column)) {
      throw badRequest(`Missing required column "${column}". Expected header: subject,difficulty,type,text,option1..option4,correct,explanation,source,license,topic`);
    }
  }
  const index = (name: string) => header.indexOf(name);
  const cell = (row: string[], name: string) => (index(name) >= 0 ? (row[index(name)] ?? "").trim() : "");

  const subjects = await prisma.subject.findMany();
  const subjectBySlug = new Map(subjects.map((s) => [s.slug, s]));
  const subjectByName = new Map(subjects.map((s) => [s.name.toLowerCase(), s]));

  const errors: Array<{ row: number; message: string }> = [];
  const prepared: Array<{
    subjectId: string;
    topicName: string | null;
    difficulty: string;
    type: string;
    text: string;
    explanation: string | null;
    source: string | null;
    license: string | null;
    options: Array<{ text: string; isCorrect: boolean }>;
  }> = [];

  const seen = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1;
    try {
      const subjectKey = cell(row, "subject").toLowerCase();
      const subject = subjectBySlug.get(subjectKey) ?? subjectByName.get(subjectKey);
      if (!subject) {
        throw new Error(`Unknown subject "${cell(row, "subject")}". Create the subject first.`);
      }
      const difficulty = cell(row, "difficulty").toUpperCase();
      if (!["EASY", "MEDIUM", "HARD"].includes(difficulty)) {
        throw new Error(`Invalid difficulty "${cell(row, "difficulty")}" (use EASY, MEDIUM or HARD).`);
      }
      const typeRaw = (cell(row, "type") || "single").toLowerCase();
      const type = typeRaw.startsWith("mult") ? "MULTIPLE_CHOICE" : "SINGLE_CHOICE";
      const text = cell(row, "text");
      if (text.length < 5) throw new Error("Question text is too short.");

      const options: Array<{ text: string; isCorrect: boolean }> = [];
      for (const name of ["option1", "option2", "option3", "option4", "option5", "option6"]) {
        const value = cell(row, name);
        if (value) options.push({ text: value, isCorrect: false });
      }
      if (options.length < 2) throw new Error("At least two options are required.");

      const correctRaw = cell(row, "correct");
      const correctIndexes = correctRaw
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((n) => Number.isInteger(n));
      if (correctIndexes.length === 0) throw new Error("The 'correct' column must contain option numbers (1-based).");
      for (const correctIndex of correctIndexes) {
        if (correctIndex < 1 || correctIndex > options.length) {
          throw new Error(`Correct option ${correctIndex} is out of range (1-${options.length}).`);
        }
        options[correctIndex - 1].isCorrect = true;
      }
      if (type === "SINGLE_CHOICE" && correctIndexes.length > 1) {
        throw new Error("Single-choice questions must have exactly one correct option.");
      }

      const duplicateKey = `${subject.id}|${text.toLowerCase()}`;
      if (seen.has(duplicateKey)) throw new Error("Duplicate of an earlier row in this file.");
      seen.add(duplicateKey);

      prepared.push({
        subjectId: subject.id,
        topicName: cell(row, "topic") || null,
        difficulty,
        type,
        text,
        explanation: cell(row, "explanation") || null,
        source: cell(row, "source") || null,
        license: cell(row, "license") || null,
        options,
      });
    } catch (error) {
      errors.push({ row: rowNumber, message: error instanceof Error ? error.message : "Invalid row." });
    }
  }

  if (prepared.length === 0) {
    throw unprocessable("No valid rows to import.", "IMPORT_EMPTY", { errors });
  }

  let imported = 0;
  await prisma.$transaction(async (tx) => {
    for (const item of prepared) {
      let topicId: string | null = null;
      if (item.topicName) {
        const slug = item.topicName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const topic = await tx.topic.upsert({
          where: { subjectId_slug: { subjectId: item.subjectId, slug } },
          update: {},
          create: { subjectId: item.subjectId, slug, name: item.topicName },
        });
        topicId = topic.id;
      }
      await tx.question.create({
        data: {
          subjectId: item.subjectId,
          topicId,
          difficulty: item.difficulty,
          type: item.type,
          text: item.text,
          explanation: item.explanation,
          source: item.source,
          license: item.license,
          status: "DRAFT",
          createdById: auth.user.id,
          options: { create: item.options.map((option, i) => ({ text: option.text, isCorrect: option.isCorrect, sortOrder: i })) },
        },
      });
      imported += 1;
    }
  });

  await writeAudit({
    actorId: auth.user.id,
    action: "question.csv_import",
    entityType: "Question",
    after: { imported, failed: errors.length },
  });

  return ok({ imported, failed: errors.length, errors: errors.slice(0, 50) });
});
