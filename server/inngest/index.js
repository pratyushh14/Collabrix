import { Inngest } from "inngest";
import prisma from "../configs/prisma.js";
import sendEmail from "../configs/nodemailer.js";

export const inngest = new Inngest({ id: "Collabrix" });

/* ================= USERS ================= */

// ✅ USER CREATE (safe)
const syncUserCreation = inngest.createFunction(
  {
    id: "sync-user-from-clerk",
    triggers: [{ event: "clerk/user.created" }],
  },
  async ({ event, step }) => {
    const { data } = event;

    await step.run("create-user", async () => {
      await prisma.user.upsert({
        where: { id: data.id },
        update: {},
        create: {
          id: data.id,
          email: data?.email_addresses?.[0]?.email_address,
          name: `${data?.first_name || ""} ${data?.last_name || ""}`,
          image: data?.image_url,
        },
      });
    });
  }
);

// ✅ USER DELETE
const syncUserDeletion = inngest.createFunction(
  {
    id: "delete-user-from-clerk",
    triggers: [{ event: "clerk/user.deleted" }],
  },
  async ({ event, step }) => {
    const { data } = event;

    await step.run("delete-user", async () => {
      await prisma.user.delete({
        where: { id: data.id },
      });
    });
  }
);

// ✅ USER UPDATE
const syncUserUpdation = inngest.createFunction(
  {
    id: "update-user-from-clerk",
    triggers: [{ event: "clerk/user.updated" }],
  },
  async ({ event, step }) => {
    const { data } = event;

    await step.run("update-user", async () => {
      await prisma.user.update({
        where: { id: data.id },
        data: {
          email: data?.email_addresses?.[0]?.email_address,
          name: `${data?.first_name || ""} ${data?.last_name || ""}`,
          image: data?.image_url,
        },
      });
    });
  }
);

/* ================= WORKSPACE ================= */

// ✅ CREATE OR UPDATE WORKSPACE (IMPORTANT FIX)
const syncWorkspaceCreation = inngest.createFunction(
  {
    id: "sync-workspace-from-clerk",
    triggers: [{ event: "clerk/organization.created" }],
  },
  async ({ event, step }) => {
    const { data } = event;

    await step.run("upsert-workspace", async () => {
      await prisma.workspace.upsert({
        where: { id: data.id },
        update: {
          name: data.name,
          slug: data.slug,
          image_url: data.image_url,
        },
        create: {
          id: data.id,
          name: data.name,
          slug: data.slug,
          ownerId: data.created_by,
          image_url: data.image_url,
        },
      });
    });

    // ✅ ensure owner is member
    await step.run("upsert-admin-member", async () => {
      await prisma.workspaceMember.upsert({
        where: {
          userId_workspaceId: {
            userId: data.created_by,
            workspaceId: data.id,
          },
        },
        update: {},
        create: {
          userId: data.created_by,
          workspaceId: data.id,
          role: "ADMIN",
        },
      });
    });
  }
);

// ✅ WORKSPACE UPDATE
const syncWorkspaceUpdation = inngest.createFunction(
  {
    id: "update-workspace-from-clerk",
    triggers: [{ event: "clerk/organization.updated" }],
  },
  async ({ event, step }) => {
    const { data } = event;

    await step.run("update-workspace", async () => {
      await prisma.workspace.update({
        where: { id: data.id },
        data: {
          name: data.name,
          slug: data.slug,
          image_url: data.image_url,
        },
      });
    });
  }
);

// ✅ WORKSPACE DELETE
const syncWorkspaceDeletion = inngest.createFunction(
  {
    id: "delete-workspace-with-clerk",
    triggers: [{ event: "clerk/organization.deleted" }],
  },
  async ({ event, step }) => {
    const { data } = event;

    await step.run("delete-workspace", async () => {
      await prisma.workspace.delete({
        where: { id: data.id },
      });
    });
  }
);

/* ================= MEMBERS ================= */

// ✅ MEMBER CREATE (CRITICAL FIX)
const syncWorkspaceMemberCreation = inngest.createFunction(
  {
    id: "sync-workspace-member-from-clerk",
    triggers: [{ event: "clerk/organizationMembership.created" }],
  },
  async ({ event, step }) => {
    const { data } = event;

    console.log("🔥 MEMBER EVENT:", data);

    await step.run("upsert-member", async () => {
      const rawRole = String(data.role).toUpperCase();
      const definedRole = rawRole.includes("ADMIN") ? "ADMIN" : "MEMBER";
      
      await prisma.workspaceMember.upsert({
        where: {
          userId_workspaceId: {
            userId: data.public_user_data.user_id, // ✅ FIXED
            workspaceId: data.organization.id,
          },
        },
        update: {
          role: definedRole,
        },
        create: {
          userId: data.public_user_data.user_id,
          workspaceId: data.organization.id,
          role: definedRole,
        },
      });
    });
  }
);

/* ================= EMAIL ================= */

const syncTaskAssignmentEmail = inngest.createFunction(
  {
    id: "send-email-on-task-assignment",
    retries: 3,
    triggers: [{ event: "app/task.assigned" }],
  },
  async ({ event, step }) => {
    const { taskId } = event.data;

    const task = await step.run("fetch-task", async () => {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { assignee: true, project: true },
      });

      if (!task) throw new Error(`Task ${taskId} not found`);
      if (!task.assignee) throw new Error(`No assignee`);

      return task;
    });

    await step.run("send-email", async () => {
      await sendEmail({
        to: task.assignee.email,
        subject: `New Task: ${task.project.name} - ${task.title}`,
        html: `<p>You have a new task: ${task.title}</p>`,
      });
    });

    return { success: true };
  }
);

/* ================= EXPORT ================= */

export const functions = [
  syncUserCreation,
  syncUserDeletion,
  syncUserUpdation,
  syncWorkspaceCreation,
  syncWorkspaceUpdation,
  syncWorkspaceDeletion,
  syncWorkspaceMemberCreation,
  syncTaskAssignmentEmail,
];