import prisma from "../configs/prisma.js";  

export const getUserWorkspaces = async (req, res) => {
    try {
        const userId = req.userId
        const workspaces = await prisma.workspace.findMany({
            where: {
                members: { some: { userId: userId } },
            },
            include: {
                members: { include: { user: true } },
                projects: {
                    include: {
                        tasks: {
                            include: {
                                assignee: true,
                                comments: {
                                    include: { user: true }
                                }
                            }
                        },
                        members: { include: { user: true } }
                    }
                },
                owner: true
            }
        });
        res.json(workspaces)
    } catch(error) {
        console.error(error);
        res.status(500).json({ message: error.code || error.message });
    }
}

export const addMember = async (req, res) => {
    try {
        const userId = req.userId
        const { email, workspaceId, role, message } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(404).json({ message: "User not found" });
        if (!workspaceId || !role) return res.status(400).json({ message: "Invalid request data" });
        if (!["ADMIN", "MEMBER"].includes(role)) return res.status(400).json({ message: "Invalid role" });

        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            include: { members: true }
        });
        if (!workspace) return res.status(404).json({ message: "Workspace not found" });

        if (!workspace.members.find((member) => member.userId === userId && member.role === "ADMIN"))
            return res.status(403).json({ message: "You are not authorized to add members" });

        const existingMember = workspace.members.find((member) => member.userId === user.id);
        if (existingMember) return res.status(400).json({ message: "User is already a member of this workspace" });

        const member = await prisma.workspaceMember.create({
            data: {
                userId: user.id,
                workspaceId,
                role,
                message,
            }
        });
        res.json({ member, message: "Member added successfully" });
    } catch(error) {
        console.error(error);
        res.status(500).json({ message: error.code || error.message });
    }
}