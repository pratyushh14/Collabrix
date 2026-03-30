import express from 'express';
import { createTask, updateTask, deleteTask, getProjectTasks, getTaskById } from '../controllers/taskController.js';

const taskRouter = express.Router();

taskRouter.post('/', createTask);                           // POST   /api/tasks
taskRouter.put('/:id', updateTask);                         // PUT    /api/tasks/:id
taskRouter.delete('/:id', deleteTask);                      // DELETE /api/tasks/:id
taskRouter.get('/project/:projectId', getProjectTasks);     // GET    /api/tasks/project/:projectId
taskRouter.get('/:id', getTaskById);                        // GET    /api/tasks/:id

export default taskRouter;