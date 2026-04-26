-- assets.kind: rename legacy 'gemini-bg' (from when we used Nano Banana)
-- to the provider-neutral 'image-bg'. Pure data migration — the column is
-- a TEXT in SQLite with the enum enforced at the TypeScript layer only,
-- so no DDL is needed.
UPDATE `assets` SET `kind` = 'image-bg' WHERE `kind` = 'gemini-bg';
