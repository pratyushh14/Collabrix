import prisma from '../configs/prisma.js';
import { inngest } from '../inngest/index.js';

export const createTask = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const { projectId, title, due_date, priority, description, status, assigneeId } = req.body;

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { members: { include: { user: true } } }
        });

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }
        if (project.team_lead !== userId) {
            return res.status(403).json({ message: "You are not the team lead of this project" });
        }
        if (assigneeId && !project.members.find(member => member.userId === assigneeId)) {
            return res.status(404).json({ message: "Assignee not found in project members" });
        }

        const task = await prisma.task.create({
            data: {
                title,
                description,
                due_date: due_date ? new Date(due_date) : null,
                priority,
                status,
                projectId,
                assigneeId: assigneeId || null,
            }
        });

        const taskWithAssignee = await prisma.task.findUnique({
            where: { id: task.id },
            include: { assignee: true }
        });
        await inngest.send({
            name: "app/task.assigned",
            data: {
                taskId: task.id,origin
            },
        });         

        res.json({ task: taskWithAssignee, message: "Task created successfully" });
    } catch (error) {
        console.log('Error creating task:', error);
        res.status(500).json({ message: error.code || error.message });
    }
};

export const updateTask = async (req, res) => {
    try {
        const { userId } = await req.auth(); // ✅ fixed: was missing entirely
        const { id } = req.params;           // ✅ fixed: was missing entirely
        const { title, due_date, priority, description, status, assigneeId } = req.body; // ✅ fixed: was missing entirely

        // ✅ fixed: task and project checks were jumbled together / incomplete
        const task = await prisma.task.findUnique({
            where: { id },
        });
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        const project = await prisma.project.findUnique({
            where: { id: task.projectId },
            include: { members: { include: { user: true } } }
        });
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        // Allow team lead OR the assignee of the task to update it
        const isTeamLead = project.team_lead === userId;
        const isAssignee = task.assigneeId === userId;
        if (!isTeamLead && !isAssignee) {
            return res.status(403).json({ message: "You are not authorized to update this task" });
        }

        if (assigneeId && !project.members.find(member => member.userId === assigneeId)) {
            return res.status(404).json({ message: "Assignee not found in project members" });
        }

        // ✅ fixed: was calling prisma.task.create instead of prisma.task.update
        const updatedTask = await prisma.task.update({
            where: { id },
            data: {
                title,
                description,
                due_date: due_date ? new Date(due_date) : null,
                priority,
                status,
                assigneeId: assigneeId || null,
            }
        });

        const taskWithAssignee = await prisma.task.findUnique({
            where: { id: updatedTask.id },
            include: { assignee: true }
        });

        res.json({ task: taskWithAssignee, message: "Task updated successfully" });
    } catch (error) {
        console.log('Error updating task:', error);
        res.status(500).json({ message: error.code || error.message });
    }
};

export const deleteTask = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const { id } = req.params;

        const task = await prisma.task.findUnique({
            where: { id },
        });
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        const project = await prisma.project.findUnique({
            where: { id: task.projectId },
        });
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }
        if (project.team_lead !== userId) {
            return res.status(403).json({ message: "You are not the team lead of this project" });
        }

        await prisma.task.delete({ where: { id } });

        res.json({ message: "Task deleted successfully" });
    } catch (error) {
        console.log('Error deleting task:', error);
        res.status(500).json({ message: error.code || error.message });
    }
};

export const getProjectTasks = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const { projectId } = req.params;

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { members: { include: { user: true } } }
        });
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        // Only project members or team lead can view tasks
        const isMember = project.members.find(member => member.userId === userId);
        const isTeamLead = project.team_lead === userId;
        if (!isMember && !isTeamLead) {
            return res.status(403).json({ message: "You are not a member of this project" });
        }

        const tasks = await prisma.task.findMany({
            where: { projectId },
            include: {
                assignee: true,
                comments: { include: { user: true } }
            },
            orderBy: { createdAt: 'asc' }
        });

        res.json({ tasks, message: "Tasks fetched successfully" });
    } catch (error) {
        console.log('Error fetching tasks:', error);
        res.status(500).json({ message: error.code || error.message });
    }
};

export const getTaskById = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const { id } = req.params;

        const task = await prisma.task.findUnique({
            where: { id },
            include: {
                assignee: true,
                comments: { include: { user: true } }
            }
        });
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        const project = await prisma.project.findUnique({
            where: { id: task.projectId },
            include: { members: true }
        });

        const isMember = project.members.find(member => member.userId === userId);
        const isTeamLead = project.team_lead === userId;
        if (!isMember && !isTeamLead) {
            return res.status(403).json({ message: "You are not a member of this project" });
        }

        res.json({ task, message: "Task fetched successfully" });
    } catch (error) {
        console.log('Error fetching task:', error);
        res.status(500).json({ message: error.code || error.message });
    }
};