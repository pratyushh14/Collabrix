import express from 'express';
import { addMember, getUserWorkspaces, syncWorkspaceMembers } from '../controllers/workspaceController.js';
const workspaceRouter = express.Router();
workspaceRouter.get('/', getUserWorkspaces);
workspaceRouter.post('/add-member', addMember);
workspaceRouter.post('/:id/sync-members', syncWorkspaceMembers);
export default workspaceRouter;