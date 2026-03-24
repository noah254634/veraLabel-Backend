import express from 'express'
import { taskController } from './task.controller.js'
const router=express.Router()
router.post('/createTasks',taskController.createTasks)
router.get('/',taskController.getTasks)
router.get('/getTask/:id',taskController.getTaskById)
router.put('/returnTaskToPool/:id',taskController.returnTaskToPool)
router.post('/:id/assign',taskController.assignTask)
router.put('/submit/:id',taskController.submitTask)
router.put('/verify/:id',taskController.verifyTask)
router.put('/rejectTask/:id/reject',taskController.rejectTask)
router.delete('/deleteTask/:id',taskController.deleteTask)
router.post('/reviewTask/:id',taskController.reviewTask)
router.post('/revoke',taskController.revokeTask)
router.post('/auto_assign',taskController.autoAssignTask)

export default router;