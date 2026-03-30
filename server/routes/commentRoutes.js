import express from 'express';
import { addComment, getTaskComments, updateComment, deleteComment } from '../controllers/commentController.js';

const commentRouter = express.Router();

commentRouter.post('/', addComment);                        // POST   /api/comments
commentRouter.get('/task/:taskId', getTaskComments);        // GET    /api/comments/task/:taskId
commentRouter.put('/:id', updateComment);                   // PUT    /api/comments/:id
commentRouter.delete('/:id', deleteComment);                // DELETE /api/comments/:id

export default commentRouter;