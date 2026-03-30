import prisma from "../configs/prisma.js";

export const addComment = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const { taskId, content } = req.body;

        if (!content?.trim()) {
            return res.status(400).json({ message: "Comment content cannot be empty" });
        }

        // ✅ fixed: typo 'tast' → 'task', and added proper not-found + auth checks
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: {
                project: {
                    include: { members: true }
                }
            }
        });

        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        // Only project members or team lead can comment
        const isMember = task.project.members.find(m => m.userId === userId);
        const isTeamLead = task.project.team_lead === userId;
        if (!isMember && !isTeamLead) {
            return res.status(403).json({ message: "You are not a member of this project" });
        }

        const comment = await prisma.comment.create({
            data: {
                content,
                userId,
                taskId,
            },
            include: { user: true }  // return user details with comment
        });

        res.json({ comment, message: "Comment added successfully" });
    } catch (error) {
        console.log('Error adding comment:', error);
        res.status(500).json({ message: error.code || error.message });
    }
};

export const getTaskComments = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const { taskId } = req.params;

        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: {
                project: { include: { members: true } }
            }
        });

        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        const isMember = task.project.members.find(m => m.userId === userId);
        const isTeamLead = task.project.team_lead === userId;
        if (!isMember && !isTeamLead) {
            return res.status(403).json({ message: "You are not a member of this project" });
        }

        const comments = await prisma.comment.findMany({
            where: { taskId },
            include: { user: true },
            orderBy: { createdAt: 'asc' }
        });

        res.json({ comments, message: "Comments fetched successfully" });
    } catch (error) {
        console.log('Error fetching comments:', error);
        res.status(500).json({ message: error.code || error.message });
    }
};

export const updateComment = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const { id } = req.params;
        const { content } = req.body;

        if (!content?.trim()) {
            return res.status(400).json({ message: "Comment content cannot be empty" });
        }

        const comment = await prisma.comment.findUnique({
            where: { id }
        });

        if (!comment) {
            return res.status(404).json({ message: "Comment not found" });
        }

        // Only the comment author can edit it
        if (comment.userId !== userId) {
            return res.status(403).json({ message: "You are not authorized to update this comment" });
        }

        const updatedComment = await prisma.comment.update({
            where: { id },
            data: { content },
            include: { user: true }
        });

        res.json({ comment: updatedComment, message: "Comment updated successfully" });
    } catch (error) {
        console.log('Error updating comment:', error);
        res.status(500).json({ message: error.code || error.message });
    }
};

export const deleteComment = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const { id } = req.params;

        const comment = await prisma.comment.findUnique({
            where: { id },
            include: {
                task: {
                    include: { project: true }
                }
            }
        });

        if (!comment) {
            return res.status(404).json({ message: "Comment not found" });
        }

        // Comment author OR project team lead can delete a comment
        const isAuthor = comment.userId === userId;
        const isTeamLead = comment.task.project.team_lead === userId;
        if (!isAuthor && !isTeamLead) {
            return res.status(403).json({ message: "You are not authorized to delete this comment" });
        }

        await prisma.comment.delete({ where: { id } });

        res.json({ message: "Comment deleted successfully" });
    } catch (error) {
        console.log('Error deleting comment:', error);
        res.status(500).json({ message: error.code || error.message });
    }
};