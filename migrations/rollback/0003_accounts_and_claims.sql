-- Safe only before account traffic is enabled. Recover forward once users exist.
DROP TABLE IF EXISTS claim_tokens;
DROP TABLE IF EXISTS trip_memberships;
DROP TABLE IF EXISTS auth_tokens;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS auth_identities;
DROP TABLE IF EXISTS users;
