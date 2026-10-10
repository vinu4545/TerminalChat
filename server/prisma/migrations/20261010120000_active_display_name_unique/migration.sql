
-- Preserve historical members and add explicit membership state.
ALTER TABLE "Member"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Remove the old unconditional unique constraint.
ALTER TABLE "Member"
DROP CONSTRAINT IF EXISTS "Member_workspaceId_usernameNormalized_key";

-- Add indexes for membership lookups.
CREATE INDEX "Member_workspaceId_usernameNormalized_idx"
ON "Member"("workspaceId", "usernameNormalized");

CREATE INDEX "Member_workspaceId_isActive_idx"
ON "Member"("workspaceId", "isActive");

-- Only active members must have unique display names per workspace.
CREATE UNIQUE INDEX "Member_active_workspace_username_key"
ON "Member"("workspaceId", "usernameNormalized")
WHERE "isActive" = true;
