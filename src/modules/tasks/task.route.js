import express from 'express'
import { taskController } from './task.controller.js'
const router=express.Router()
router.post('/tasks',taskController.createTasks)
router.get('/tasks',taskController.getTasks)
router.get('/tasks/:id',taskController.getTaskById)
router.put('/tasks/:id',taskController.returnTaskToPool)
router.post('/tasks/:id/assign',taskController.assignTask)
router.put('/tasks/:id/submit',taskController.submitTask)
router.put('/tasks/:id/verify',taskController.verifyTask)
router.put('/tasks/:id/reject',taskController.rejectTask)
router.delete('/tasks/:id/delete',taskController.deleteTask)
router.post('/tasks/:id/review',taskController.reviewTask)
router.post('/tasks/revoke',taskController.revokeTask)
router.post('/auto_assign',taskController.autoAssignTask)

export default router;