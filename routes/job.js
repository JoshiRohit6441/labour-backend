import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { validatePagination } from '../middleware/validation.js';

const router = express.Router();

// Public routes (with optional auth)
// Note: Most job functionality has been moved to user and contractor specific routes
// This route file is kept for any public job-related endpoints

// Public endpoint to get nearby jobs (for browsing without authentication)
router.get('/nearby', optionalAuth, validatePagination, (req, res) => {
  // This functionality is now handled in contractor routes
  // Keeping this as a placeholder for public job browsing
  res.json({
    message: 'Public job browsing endpoint - functionality moved to contractor routes',
    note: 'Use /api/contractor/nearby-jobs for authenticated contractor access'
  });
});

export default router;
