-- One-domain-one-org rule: enforce uniqueness at the DB layer.
-- Partial index — personal workspaces have meaningless domains (and many are
-- NULL) so we exclude them. Catches concurrent createOrg races even when the
-- app-level check in createOrgWorkspaceAction is bypassed.
CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_unique_org_domain"
  ON "workspaces" ("domain")
  WHERE "type" = 'organization';
