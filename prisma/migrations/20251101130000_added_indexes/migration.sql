CREATE INDEX "jobs_status_idx" ON "jobs"("status");
CREATE INDEX "jobs_jobType_idx" ON "jobs"("jobType");
CREATE INDEX "location_idx" ON "jobs" USING GIST ("latitude", "longitude");