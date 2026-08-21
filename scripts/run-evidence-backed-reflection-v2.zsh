#runner是 Eval harness，不是产品运行逻辑； 它只负责调用系统、采集证据，不改变被测系统。

#!/bin/zsh

set -euo pipefail

PROJECT_ROOT="${1:-$PWD}"
API_BASE="${LIFEOS_API_BASE:-http://127.0.0.1:3000}"
DATABASE_PATH="$PROJECT_ROOT/prisma/dev.db"
RUN_DIR="$PROJECT_ROOT/evals/runs/evidence-backed-reflection-v2"

required_commands=(curl jq sqlite3 shasum git)
case_ids=(
  cmsvy4cxg0001gduwjd8vfm8b
  cmsvyk1q30002gduweaxz8hnf
  cmsvyxw060003gduwkfysgi1m
  cmsvzq8bo0004gduwu89vu2jq
  cmsvzytc60005gduwbby0avy1
)

fail() {
  print -u2 -- "ERROR: $1"
  exit 1
}

for command_name in "${required_commands[@]}"; do
  command -v "$command_name" >/dev/null 2>&1 || \
    fail "Required command is missing: $command_name"
done

[[ -f "$PROJECT_ROOT/package.json" ]] || \
  fail "package.json was not found under: $PROJECT_ROOT"

project_name="$(jq -r '.name // empty' "$PROJECT_ROOT/package.json")"
[[ "$project_name" == "lifeos-app" ]] || \
  fail "Expected lifeos-app, found: ${project_name:-unknown}"

[[ -f "$DATABASE_PATH" ]] || \
  fail "Prisma database was not found: $DATABASE_PATH"

database_tables="$(sqlite3 "$DATABASE_PATH" '.tables')"
[[ "$database_tables" == *Reflection* ]] || \
  fail "Reflection table was not found in: $DATABASE_PATH"

if ! curl -fsS --max-time 5 "$API_BASE/api/reflections" >/dev/null; then
  fail "LifeOS is not reachable at $API_BASE. Start it with: npm run dev"
fi

case "$RUN_DIR" in
  "$PROJECT_ROOT"/evals/runs/evidence-backed-reflection-v2)
    ;;
  *)
    fail "Unexpected run directory: $RUN_DIR"
    ;;
esac

mkdir -p "$RUN_DIR"

env_value() {
  local key="$1"
  local env_file="$PROJECT_ROOT/.env"

  if [[ ! -f "$env_file" ]]; then
    print -- "<missing .env>"
    return
  fi

  sed -n "s/^${key}=//p" "$env_file" | tail -n 1 | tr -d '"'
}

api_key_state="missing"
if [[ -n "$(env_value OPENAI_API_KEY)" ]]; then
  api_key_state="set"
fi

openai_model="$(env_value OPENAI_MODEL)"
mock_llm="$(env_value MOCK_LLM)"

{
  print -- "run_started_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  print -- "project_root=$PROJECT_ROOT"
  print -- "api_base=$API_BASE"
  print -- "database_path=$DATABASE_PATH"
  print -- "openai_api_key=$api_key_state"
  print -- "openai_model=$openai_model"
  print -- "mock_llm=$mock_llm"
  print -- "git_head=$(git -C "$PROJECT_ROOT" rev-parse HEAD)"
} > "$RUN_DIR/run-metadata.txt"

git -C "$PROJECT_ROOT" status --short > "$RUN_DIR/git-status-before.txt"

sqlite3 -separator '|' "$DATABASE_PATH" \
  "SELECT id, content, createdAt FROM Reflection ORDER BY id;" \
  > "$RUN_DIR/reflections-before.txt"

sqlite3 -separator '|' "$DATABASE_PATH" \
  "SELECT id, reflectionId, result, COALESCE(model, ''), createdAt FROM AIAnalysis ORDER BY id;" \
  > "$RUN_DIR/ai-analysis-before.txt"

sqlite3 "$DATABASE_PATH" \
  "SELECT COUNT(*) FROM Reflection;" \
  > "$RUN_DIR/reflection-count-before.txt"

sqlite3 "$DATABASE_PATH" \
  "SELECT COUNT(*) FROM AIAnalysis;" \
  > "$RUN_DIR/ai-analysis-count-before.txt"

shasum -a 256 "$RUN_DIR/reflections-before.txt" \
  > "$RUN_DIR/reflections-before.sha256"

shasum -a 256 "$RUN_DIR/ai-analysis-before.txt" \
  > "$RUN_DIR/ai-analysis-before.sha256"

print -- "case\thttp_status\tmodel\tstatus\tinsight_count\tremoved_evidence" \
  > "$RUN_DIR/case-summary.tsv"

case_number=1

for case_id in "${case_ids[@]}"; do
  case_prefix="$RUN_DIR/case-$case_number"

  reflection_exists="$(sqlite3 "$DATABASE_PATH" \
    "SELECT COUNT(*) FROM Reflection WHERE id = '$case_id';")"

  [[ "$reflection_exists" == "1" ]] || \
    fail "Case $case_number Reflection was not found: $case_id"

  sqlite3 -separator '|' "$DATABASE_PATH" \
    "SELECT id, content, createdAt FROM Reflection WHERE id = '$case_id';" \
    > "$case_prefix-current-reflection.txt"

  sqlite3 "$DATABASE_PATH" \
    "SELECT id
       FROM Reflection
      WHERE id <> '$case_id'
        AND createdAt < (
          SELECT createdAt FROM Reflection WHERE id = '$case_id'
        )
      ORDER BY createdAt DESC
      LIMIT 5;" \
    > "$case_prefix-expected-retrieval-ids.txt"

  http_status="$(curl -sS \
    --max-time 120 \
    -X POST \
    -H 'Accept: application/json' \
    -o "$case_prefix-response.json" \
    -w '%{http_code}' \
    "$API_BASE/api/reflections/$case_id/analyze-with-evidence")"

  print -- "$http_status" > "$case_prefix-http-status.txt"

  if jq -e . "$case_prefix-response.json" >/dev/null 2>&1; then
    jq . "$case_prefix-response.json" > "$case_prefix-response.pretty.json"

    jq -r '.retrieval.reflectionIds[]? // empty' \
      "$case_prefix-response.json" \
      > "$case_prefix-actual-retrieval-ids.txt"

    if diff -u \
      "$case_prefix-expected-retrieval-ids.txt" \
      "$case_prefix-actual-retrieval-ids.txt" \
      > "$case_prefix-retrieval.diff"; then
      print -- "PASS" > "$case_prefix-retrieval-result.txt"
    else
      print -- "FAIL" > "$case_prefix-retrieval-result.txt"
    fi

    model="$(jq -r '.analysis.model // "<missing>"' "$case_prefix-response.json")"
    result_status="$(jq -r '.analysis.result.status // "<missing>"' "$case_prefix-response.json")"
    insight_count="$(jq -r '.analysis.result.insights | length' "$case_prefix-response.json" 2>/dev/null || print -- '<missing>')"
    removed_evidence="$(jq -r '.validation.removedEvidenceCount // "<missing>"' "$case_prefix-response.json")"
  else
    print -- "INVALID_JSON" > "$case_prefix-retrieval-result.txt"
    model="<invalid-json>"
    result_status="<invalid-json>"
    insight_count="<invalid-json>"
    removed_evidence="<invalid-json>"
  fi

  print -- "$case_number\t$http_status\t$model\t$result_status\t$insight_count\t$removed_evidence" \
    >> "$RUN_DIR/case-summary.tsv"

  case_number=$((case_number + 1))
done

sqlite3 -separator '|' "$DATABASE_PATH" \
  "SELECT id, content, createdAt FROM Reflection ORDER BY id;" \
  > "$RUN_DIR/reflections-after.txt"

sqlite3 -separator '|' "$DATABASE_PATH" \
  "SELECT id, reflectionId, result, COALESCE(model, ''), createdAt FROM AIAnalysis ORDER BY id;" \
  > "$RUN_DIR/ai-analysis-after.txt"

sqlite3 "$DATABASE_PATH" \
  "SELECT COUNT(*) FROM Reflection;" \
  > "$RUN_DIR/reflection-count-after.txt"

sqlite3 "$DATABASE_PATH" \
  "SELECT COUNT(*) FROM AIAnalysis;" \
  > "$RUN_DIR/ai-analysis-count-after.txt"

shasum -a 256 "$RUN_DIR/reflections-after.txt" \
  > "$RUN_DIR/reflections-after.sha256"

shasum -a 256 "$RUN_DIR/ai-analysis-after.txt" \
  > "$RUN_DIR/ai-analysis-after.sha256"

if cmp -s "$RUN_DIR/reflections-before.txt" "$RUN_DIR/reflections-after.txt"; then
  reflections_state="PASS"
else
  reflections_state="FAIL"
fi

if cmp -s "$RUN_DIR/ai-analysis-before.txt" "$RUN_DIR/ai-analysis-after.txt"; then
  ai_analysis_state="PASS"
else
  ai_analysis_state="FAIL"
fi

{
  print -- "reflections_unchanged=$reflections_state"
  print -- "ai_analysis_unchanged=$ai_analysis_state"
  print -- "run_finished_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
} > "$RUN_DIR/state-comparison.txt"

git -C "$PROJECT_ROOT" status --short > "$RUN_DIR/git-status-after.txt"

print -- ""
print -- "V2 raw artifacts saved to:"
print -- "$RUN_DIR"
print -- ""
print -- "Case summary:"
column -t -s $'\t' "$RUN_DIR/case-summary.tsv"
print -- ""
print -- "Business state comparison:"
sed -n '1,2p' "$RUN_DIR/state-comparison.txt"

