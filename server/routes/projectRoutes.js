import express from 'express';
import { createProject, updateProject, addMember } from '../controllers/projectController.js';

const projectRouter = express.Router();

projectRouter.post('/', createProject);
projectRouter.put('/:id', updateProject);           // ✅ fixed: added /:id param
projectRouter.post('/:projectId/addmember', addMember);

export default projectRouter;