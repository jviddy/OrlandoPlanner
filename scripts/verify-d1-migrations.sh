#!/bin/sh
set -eu

d1_verify_dir="$(mktemp -d "${TMPDIR:-/tmp}/orlando-planner-d1.XXXXXX")"
trap 'rm -rf "$d1_verify_dir"' EXIT INT TERM

npx wrangler d1 migrations apply orlando-planner-preview --local --persist-to "$d1_verify_dir"

applied_tables="$(npx wrangler d1 execute orlando-planner-preview --local --persist-to "$d1_verify_dir" --command "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name" --json)"
for expected_table in trips trip_capabilities idempotency_records activity_log rate_limit_buckets users sessions auth_tokens trip_memberships claim_tokens invitations; do
  printf '%s' "$applied_tables" | grep -Eq "\"${expected_table}\""
done

npx wrangler d1 execute orlando-planner-preview --local --persist-to "$d1_verify_dir" --file migrations/rollback/0004_invitations.sql --yes
npx wrangler d1 execute orlando-planner-preview --local --persist-to "$d1_verify_dir" --file migrations/rollback/0003_accounts_and_claims.sql --yes
npx wrangler d1 execute orlando-planner-preview --local --persist-to "$d1_verify_dir" --file migrations/rollback/0002_canonical_trips.sql --yes
npx wrangler d1 execute orlando-planner-preview --local --persist-to "$d1_verify_dir" --file migrations/rollback/0001_anonymous_trips.sql --yes

rolled_back_tables="$(npx wrangler d1 execute orlando-planner-preview --local --persist-to "$d1_verify_dir" --command "SELECT name FROM sqlite_master WHERE type = 'table' AND (name LIKE 'anonymous_%' OR name IN ('trips', 'trip_capabilities', 'idempotency_records', 'activity_log', 'rate_limit_buckets', 'users', 'sessions', 'auth_tokens', 'trip_memberships', 'claim_tokens', 'invitations'))" --json)"
if printf '%s' "$rolled_back_tables" | grep -Eq '"name"'; then
  printf '%s\n' 'Application tables remained after rollback.' >&2
  exit 1
fi

printf '%s\n' 'D1 forward migrations and rollback verified.'
