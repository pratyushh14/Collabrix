import prisma from '../configs/prisma.js';

export const createProject = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const { workspaceId, description, name, status, start_date, end_date, team_members, team_lead, progress, priority } = req.body;

        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            include: { members: { include: { user: true } } }
        });

        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }
        if (!workspace.members.some(member => member.userId === userId && member.role === 'ADMIN')) {
            return res.status(403).json({ message: "You are not an admin of this workspace" });
        }

        const teamLead = await prisma.user.findUnique({
            where: { email: team_lead },
            select: { id: true }
        });

        const project = await prisma.project.create({
            data: {
                name,
                description,
                status,
                start_date: start_date ? new Date(start_date) : null,
                end_date: end_date ? new Date(end_date) : null,
                progress,
                priority,
                workspaceId,
                team_lead: teamLead?.id,
            }
        });

        if (team_members?.length > 0) {
            const membersToAdd = [];
            workspace.members.forEach(member => {
                if (team_members.includes(member.user.email)) {
                    membersToAdd.push(member.user.id);
                }
            });

            await prisma.projectMember.createMany({
                data: membersToAdd.map(memberId => ({   // ✅ fixed: was `userId => ... userId: memberId`
                    projectId: project.id,
                    userId: memberId
                }))
            });
        }

        const projectWithMembers = await prisma.project.findUnique({
            where: { id: project.id },
            include: {
                members: { include: { user: true } },
                tasks: { include: { assignees: true, comments: { include: { user: true } } } },
                owner: true
            }
        });

        res.json({ project: projectWithMembers, message: "Project created successfully" });
    } catch (error) {
        console.log('Error creating project:', error);
        res.status(500).json({ message: error.code || error.message });
    }
};

export const updateProject = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const { id } = req.params; // ✅ fixed: id was never extracted
        const { workspaceId, description, name, status, start_date, end_date, team_members, team_lead, progress, priority } = req.body;

        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            include: { members: { include: { user: true } } }
        });

        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        const isAdmin = workspace.members.some(member => member.userId === userId && member.role === 'ADMIN');

        if (!isAdmin) {
            const existingProject = await prisma.project.findUnique({
                where: { id },
            });
            if (!existingProject) {
                return res.status(404).json({ message: "Project not found" });
            }
            if (existingProject.team_lead !== userId) {
                return res.status(403).json({ message: "You are not authorized to update this project" });
            }
        }

        // ✅ fixed: handle team_lead update
        let teamLeadId;
        if (team_lead) {
            const teamLeadUser = await prisma.user.findUnique({
                where: { email: team_lead },
                select: { id: true }
            });
            teamLeadId = teamLeadUser?.id;
        }

        const project = await prisma.project.update({
            where: { id },
            data: {
                name,
                description,
                status,
                start_date: start_date ? new Date(start_date) : null,
                end_date: end_date ? new Date(end_date) : null,
                progress,
                priority,
                ...(teamLeadId && { team_lead: teamLeadId }), // ✅ fixed: team_lead was silently ignored
            }
        });

        // ✅ fixed: team_members update was silently ignored
        if (team_members?.length > 0) {
            // Remove existing members and re-add
            await prisma.projectMember.deleteMany({
                where: { projectId: id }
            });

            const membersToAdd = [];
            workspace.members.forEach(member => {
                if (team_members.includes(member.user.email)) {
                    membersToAdd.push(member.user.id);
                }
            });

            await prisma.projectMember.createMany({
                data: membersToAdd.map(memberId => ({
                    projectId: id,
                    userId: memberId
                }))
            });
        }

        const projectWithMembers = await prisma.project.findUnique({
            where: { id },
            include: {
                members: { include: { user: true } },
                tasks: { include: { assignees: true, comments: { include: { user: true } } } },
                owner: true
            }
        });

        res.json({ project: projectWithMembers, message: "Project updated successfully" });
    } catch (error) {
        console.log('Error updating project:', error);
        res.status(500).json({ message: error.code || error.message });
    }
};

export const addMember = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const { projectId } = req.params;
        const { email } = req.body;

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { members: { include: { user: true } } }
        });

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }
        if (project.team_lead !== userId) {
            return res.status(403).json({ message: "You are not authorized to add members to this project" });
        }

        const existingMember = project.members.find(member => member.user.email === email);
        if (existingMember) {
            return res.status(400).json({ message: "User is already a member of this project" });
        }

        const user = await prisma.user.findUnique({
            where: { email }
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // ✅ fixed: verify user is a workspace member before adding to project
        const workspaceMember = await prisma.workspaceMember.findFirst({
            where: {
                workspaceId: project.workspaceId,
                userId: user.id
            }
        });
        if (!workspaceMember) {
            return res.status(403).json({ message: "User is not a member of the workspace" });
        }

        const member = await prisma.projectMember.create({
            data: {
                userId: user.id,
                projectId,
            }
        });

        res.json({ member, message: "Member added successfully" });
    } catch (error) {
        console.log('Error adding member:', error);
        res.status(500).json({ message: error.code || error.message });
    }
};