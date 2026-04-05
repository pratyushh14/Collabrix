import prisma from "../configs/prisma.js";  

export const getUserWorkspaces = async (req, res) => {
    try {
        const userId = req.userId;

        // Auto-sync User's Clerk Memberships locally (for dev/webhook backups)
        try {
            // First ensure the User exists locally
            const me = await clerkClient.users.getUser(userId);
            if (me) {
                const existingUser = await prisma.user.findUnique({ where: { id: userId } });
                if (!existingUser) {
                    await prisma.user.create({
                        data: {
                            id: userId,
                            email: me.emailAddresses[0]?.emailAddress || "",
                            name: me.firstName ? `${me.firstName} ${me.lastName || ""}` : (me.emailAddresses[0]?.emailAddress || "Unknown"),
                            image: me.imageUrl,
                        }
                    });
                }
            }

            const userMemberships = await clerkClient.users.getOrganizationMembershipList({ userId });
            for (const membership of userMemberships.data) {
                const orgId = membership.organization.id;
                const rawRole = String(membership.role).toUpperCase();
                const definedRole = rawRole.includes("ADMIN") ? "ADMIN" : "MEMBER";

                await prisma.workspaceMember.upsert({
                    where: { userId_workspaceId: { userId, workspaceId: orgId } },
                    update: { role: definedRole },
                    create: { userId, workspaceId: orgId, role: definedRole }
                });
            }
        } catch (syncError) {
            console.warn("Soft fail on auto-syncing user memberships:", syncError.message);
        }

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

import { clerkClient } from '@clerk/express';

export const syncWorkspaceMembers = async (req, res) => {
    try {
        const { id } = req.params; // Workspace ID
        
        // Verify user authorization (must be part of the workspace)
        const userId = req.userId;
        const workspaceAuth = await prisma.workspaceMember.findFirst({
            where: { workspaceId: id, userId }
        });
        if (!workspaceAuth) {
            return res.status(403).json({ message: "Not authorized for this workspace" });
        }

        const workspace = await prisma.workspace.findUnique({ where: { id } });
        if (!workspace) return res.status(404).json({ message: "Workspace not found" });

        const memberships = await clerkClient.organizations.getOrganizationMembershipList({ organizationId: id });
        
        for (const membership of memberships.data) {
            const memberUserId = membership.publicUserData.userId;
            
            // Ensure User exists
            const existingUser = await prisma.user.findUnique({ where: { id: memberUserId } });
            if (!existingUser) {
                await prisma.user.create({
                    data: {
                        id: memberUserId,
                        email: membership.publicUserData.identifier,
                        name: membership.publicUserData.firstName ? `${membership.publicUserData.firstName} ${membership.publicUserData.lastName || ""}` : membership.publicUserData.identifier,
                        image: membership.publicUserData.imageUrl,
                    }
                });
            }

            const rawRole = String(membership.role).toUpperCase();
            const definedRole = rawRole.includes("ADMIN") ? "ADMIN" : "MEMBER";

            // Upsert WorkspaceMember
            await prisma.workspaceMember.upsert({
                where: {
                    userId_workspaceId: {
                        userId: memberUserId,
                        workspaceId: id,
                    }
                },
                update: { role: definedRole },
                create: {
                    userId: memberUserId,
                    workspaceId: id,
                    role: definedRole,
                },
            });
        }
        res.json({ message: "Members synced successfully" });
    } catch(error) {
        console.error("Clerk sync error:", error);
        res.status(500).json({ message: error.message });
    }
}