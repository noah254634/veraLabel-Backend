import express from 'express'
import { taskController } from './task.controller.js'
import { protectRoute } from '../../middlewares/auth.middleware.js'
import { attachLabeller } from '../../middlewares/labeller.middleware.js'
import authorize from '../../middlewares/authorization.middleware.js'
import { progressController } from './progress.controller.js'
import { createRateLimiter } from '../../middlewares/rateLimit.middleware.js'

const router = express.Router()

const tasksReadLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 1000 })
const tasksWriteLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 500 })
const progressLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 10000 })
const adminLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 500 })

// Submissions (Admin/Reviewer/Buyer/Superadmin)
router.get('/getTaskSubmissions', protectRoute, authorize('admin', 'superadmin', 'reviewer', 'buyer'), tasksReadLimiter, taskController.getTaskSubmissions)

// Internal tasks creation (uses its own handshake URL and expectedToken header authentication)
router.post('/createTasks', tasksWriteLimiter, taskController.createTasks)
router.post('/register', tasksWriteLimiter, taskController.createTasks)

// Tasks reading/retrieval (any authenticated user)
router.get('/', protectRoute, tasksReadLimiter, taskController.getTasks)
router.get('/getTask/:id', protectRoute, tasksReadLimiter, taskController.getTaskById)

// Task actions
router.put('/returnTaskToPool/:id', protectRoute, authorize('admin', 'superadmin', 'labeler'), tasksWriteLimiter, taskController.returnTaskToPool)
router.post('/:id/assign', protectRoute, tasksWriteLimiter, taskController.assignTask)
router.put('/submit/:id', protectRoute, attachLabeller, tasksWriteLimiter, taskController.submitTask)
router.post('/:id/flag', protectRoute, attachLabeller, tasksWriteLimiter, taskController.flagTask)
router.post('/generate-submission-url/:id', protectRoute, attachLabeller, tasksWriteLimiter, taskController.generateSubmissionUrl)

// Verification, Rejection & Review (Admin/Reviewer)
router.put('/verify/:id', protectRoute, authorize('admin', 'superadmin', 'reviewer'), tasksWriteLimiter, taskController.verifyTask)
router.put('/rejectTask/:id/reject', protectRoute, authorize('admin', 'superadmin', 'reviewer'), tasksWriteLimiter, taskController.rejectTask)
router.delete('/deleteTask/:id', protectRoute, authorize('admin', 'superadmin'), tasksWriteLimiter, taskController.deleteTask)
router.post('/reviewTask/:id', protectRoute, authorize('admin', 'superadmin', 'reviewer'), tasksWriteLimiter, taskController.reviewTask)

// Task Revocations & Management
router.post('/revoke', protectRoute, authorize('admin', 'superadmin', 'reviewer'), tasksWriteLimiter, taskController.revokeTask)
router.post('/revoke-dataset-batches', protectRoute, authorize('admin', 'superadmin', 'buyer'), tasksWriteLimiter, taskController.revokeDatasetBatches)
router.post('/revoke-expired-batches', protectRoute, authorize('admin', 'superadmin'), tasksWriteLimiter, taskController.revokeExpiredBatchesGlobal)
router.post('/generate-missing-embeddings', protectRoute, authorize('admin', 'superadmin', 'buyer'), tasksWriteLimiter, taskController.generateMissingEmbeddings)
router.post('/auto_assign', protectRoute, authorize('admin', 'superadmin'), tasksWriteLimiter, taskController.autoAssignTask)

// Labeller current workload
router.post('/claim-batch', protectRoute, attachLabeller, tasksWriteLimiter, taskController.claimBatch)
router.post('/claim-category-batch', protectRoute, attachLabeller, tasksWriteLimiter, taskController.claimCategoryBatch)
router.get('/my-active-batch', protectRoute, attachLabeller, taskController.getMyActiveBatch)
router.get('/batches', protectRoute, taskController.getBatches)

// Progress endpoints (Internal ML API calls with api-key/token check)
router.post('/progress', progressLimiter, progressController.receiveProgress)

// Progress admin controls
router.get('/progress/admin/cleanup', protectRoute, authorize('admin', 'superadmin'), adminLimiter, progressController.cleanupSessions)
router.get('/progress/admin/stats', protectRoute, authorize('admin', 'superadmin'), adminLimiter, progressController.getStats)
router.get('/progress/admin/sessions', protectRoute, authorize('admin', 'superadmin'), adminLimiter, progressController.getAllSessions)

// Progress viewing (all authenticated users)
router.get('/progress/:projectId/:datasetId/stream', protectRoute, progressController.streamProgress)
router.get('/progress/:projectId/:datasetId', protectRoute, tasksReadLimiter, progressController.getProgress)
router.delete('/progress/:projectId/:datasetId', protectRoute, authorize('admin', 'superadmin'), tasksWriteLimiter, progressController.clearProgress)

export default router;