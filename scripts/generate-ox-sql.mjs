import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(join(__dirname, "ox-import-data.json"), "utf8"));

function sqlString(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

const total = raw.order.reduce((sum, title) => sum + raw.groups[title].length, 0);
const lines = [
  `-- Auto-generated: sync ${raw.order.length} OX middle categories (${total} questions) from ox-import-data.json`,
  "-- Structure: Category(name='생활과윤리') > OxQuizSet.title(중분류) > OxQuestion.section(소분류) > question",
  "-- Paste this into Supabase SQL editor. Re-running updates each set and replaces its questions.",
  "",
  "DO $$",
  "DECLARE",
  "  cat_id text;",
  "  set_id text;",
  "  synced_sets int := 0;",
  "  synced_questions int := 0;",
  "BEGIN",
  "  SELECT id INTO cat_id FROM \"Category\" WHERE name = '생활과윤리' LIMIT 1;",
  "  IF cat_id IS NULL THEN",
  "    RAISE EXCEPTION 'Category 생활과윤리 not found. Available: %', (SELECT string_agg(name, ', ') FROM \"Category\");",
  "  END IF;",
  "",
];

for (const title of raw.order) {
  const questions = raw.groups[title];
  lines.push(`  -- ===== ${title} (${questions.length} questions) =====`);
  lines.push(`  SELECT id INTO set_id FROM "OxQuizSet" WHERE title = ${sqlString(title)} AND "categoryId" = cat_id LIMIT 1;`);
  lines.push("  IF set_id IS NULL THEN");
  lines.push("    set_id := gen_random_uuid()::text;");
  lines.push('    INSERT INTO "OxQuizSet"(id, title, thumbnail, "categoryId", difficulty, "totalQuestions", "isPopular", "createdAt")');
  lines.push(`    VALUES (set_id, ${sqlString(title)}, NULL, cat_id, '보통', ${questions.length}, false, now());`);
  lines.push("  ELSE");
  lines.push(`    DELETE FROM "OxAnswer" WHERE "questionId" IN (SELECT id FROM "OxQuestion" WHERE "oxQuizSetId" = set_id);`);
  lines.push(`    DELETE FROM "Bookmark" WHERE "oxQuizSetId" = set_id OR "oxQuestionId" IN (SELECT id FROM "OxQuestion" WHERE "oxQuizSetId" = set_id);`);
  lines.push(`    DELETE FROM "OxQuestion" WHERE "oxQuizSetId" = set_id;`);
  lines.push(`    UPDATE "OxQuizSet" SET difficulty = '보통', "totalQuestions" = ${questions.length} WHERE id = set_id;`);
  lines.push("  END IF;");
  lines.push("");
  lines.push('  INSERT INTO "OxQuestion"(id, "oxQuizSetId", "order", section, question, answer, explanation) VALUES');
  lines.push(
    questions
      .map((q, i) => {
        const suffix = i === questions.length - 1 ? ";" : ",";
        return `    (gen_random_uuid()::text, set_id, ${i + 1}, ${sqlString(q.s)}, ${sqlString(q.q)}, ${q.a === "O" ? "true" : "false"}, ${sqlString(q.e)})${suffix}`;
      })
      .join("\n")
  );
  lines.push("  synced_sets := synced_sets + 1;");
  lines.push(`  synced_questions := synced_questions + ${questions.length};`);
  lines.push(`  RAISE NOTICE 'SYNCED ${title} (${questions.length} q)';`);
  lines.push("");
}

lines.push("  RAISE NOTICE 'Done. synced sets: %, synced questions: %', synced_sets, synced_questions;");
lines.push("END $$;");
lines.push("");

writeFileSync(join(__dirname, "import-ox.sql"), lines.join("\n"));
console.log(`generated import-ox.sql: ${raw.order.length} sets, ${total} questions`);
