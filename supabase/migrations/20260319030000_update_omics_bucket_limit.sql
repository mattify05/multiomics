-- Align storage bucket limit with UI copy and expected workloads.
-- Default bucket limit in initial migration was ~500MB; the UI advertises 10GB.
-- This migration increases the limit to 10GB for the 'omics-data' bucket.

UPDATE storage.buckets
SET file_size_limit = 10737418240
WHERE id = 'omics-data';

