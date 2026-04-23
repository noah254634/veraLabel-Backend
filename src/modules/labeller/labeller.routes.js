import express from 'express';
import { labellerController } from './labeller.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { authorization } from '../../middlewares/authorization.middleware.js';

const router = express.Router();

// ===== LABELLER SELF-ENDPOINTS (auth required) =====
router.use(auth);

// Profile
router.post('/profile', labellerController.createProfile);
router.get('/profile', labellerController.getProfile);
router.patch('/profile', labellerController.updateProfile);

// Tasks
router.get('/tasks/assigned', labellerController.getAssignedTasks);
router.post('/tasks/:taskId/complete', labellerController.completeTask);
router.post('/tasks/:taskId/reject', labellerController.rejectTask);

// Earnings & Stats
router.get('/earnings', labellerController.getEarnings);
router.get('/performance', labellerController.getPerformance);
router.get('/tier', labellerController.getTier);
router.get('/stats', labellerController.getStats);

// ===== ADMIN ENDPOINTS (admin only) =====
router.use(authorization(['admin', 'superadmin']));

router.get('/top-performers', labellerController.getTopLabellersByPerformance);
router.get('/by-tier/:tier', labellerController.getLabellersByTier);

router.patch('/status', labellerController.updateLabellerStatus);
router.patch('/promote-tier', labellerController.promoteLabellerTier);
router.post('/assign-tasks', labellerController.assignTasksToLabeller);

export default router;
