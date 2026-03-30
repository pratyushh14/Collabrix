import { Inngest } from "inngest";
import prisma from "../configs/prisma.js";
import sendEmail from "../configs/nodemailer.js";

export const inngest = new Inngest({ id: "Collabrix" });

// ✅ USER CREATE
const syncUserCreation = inngest.createFunction(
  {
    id: "sync-user-from-clerk",
    triggers: [{ event: "clerk/user.created" }],
  },
  async ({ event, step }) => {
    const { data } = event;

    await step.run("create-user", async () => {
      await prisma.user.create({
        data: {
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

// ✅ WORKSPACE CREATE
const syncWorkspaceCreation = inngest.createFunction(
  {
    id: "sync-workspace-from-clerk",
    triggers: [{ event: "clerk/organization.created" }],
  },
  async ({ event, step }) => {
    const { data } = event;

    await step.run("create-workspace", async () => {
      await prisma.workspace.create({
        data: {
          id: data.id,
          name: data.name,
          slug: data.slug,
          ownerId: data.created_by,
          image_url: data.image_url,
        },
      });
    });

    await step.run("create-admin-member", async () => {
      await prisma.workspaceMember.create({
        data: {
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

// ✅ MEMBER CREATE
const syncWorkspaceMemberCreation = inngest.createFunction(
  {
    id: "sync-workspace-member-from-clerk",
    triggers: [{ event: "clerk/organizationMembership.created" }],
  },
  async ({ event, step }) => {
    const { data } = event;

    await step.run("create-member", async () => {
      await prisma.workspaceMember.create({
        data: {
          userId: data.public_user_data.user_id,
          workspaceId: data.organization.id,
          role: String(data.role).toUpperCase(),
        },
      });
    });
  }
);

// ✅ TASK EMAIL
const syncTaskAssignmentEmail = inngest.createFunction(
  {
    id: "send-email-on-task-assignment",
    retries: 3,
    triggers: [{ event: "app/task.assigned" }],
  },
  async ({ event, step }) => {
    const { taskId,origin} = event.data;

    const task = await step.run("fetch-task", async () => {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { assignee: true, project: true },
      });

      if (!task) throw new Error(`Task ${taskId} not found`);
      if (!task.assignee) throw new Error(`Task ${taskId} has no assignee`);

      return task;
    });

    await step.run("send-email", async () => {
      await sendEmail({
        to: task.assignee.email,
        subject: `New Task Assigned: ${task.project.name} - ${task.title}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
            <h2 style="color:#4F46E5;">New Task Assigned</h2>
            <p>Hi ${task.assignee.name},</p>
            <p>You have been assigned a task in <b>${task.project.name}</b>.</p>

            <div style="background:#F3F4F6;padding:16px;border-radius:8px;">
              <p><b>Task:</b> ${task.title}</p>
              <p><b>Priority:</b> ${task.priority}</p>
              <p><b>Status:</b> ${task.status}</p>
              ${
                task.due_date
                  ? `<p><b>Due:</b> ${new Date(task.due_date).toDateString()}</p>`
                  : ""
              }
              ${
                task.description
                  ? `<p><b>Description:</b> ${task.description}</p>`
                  : ""
              }
            </div>

            <p style="font-size:12px;color:#777;">
              Collabrix automated email
            </p>
          </div>
        `,
      });
    });

    return {
      success: true,
      taskId,
      assigneeEmail: task.assignee.email,
    };
  }
);

// ✅ EXPORT ALL
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