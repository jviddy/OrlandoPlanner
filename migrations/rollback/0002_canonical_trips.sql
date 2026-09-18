-- Safe only while the canonical API remains disabled. Once canonical writes are
-- enabled, recover forward rather than dropping data that migration 0001 cannot represent.
DROP TABLE IF EXISTS rate_limit_buckets;
DROP TABLE IF EXISTS activity_log;
DROP TABLE IF EXISTS idempotency_records;
DROP TABLE IF EXISTS trip_capabilities;
DROP TABLE IF EXISTS trips;
