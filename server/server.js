import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { clerkMiddleware } from '@clerk/express';
import { serve } from 'inngest/express';
import { inngest, functions } from './inngest/index.js';
import workspaceRouter from './routes/workspaceRoutes.js';
import { protect } from './middlewares/authMiddleware.js';
import { Webhook } from 'svix';
import prisma from './configs/prisma.js';

const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'https://your-vercel-app.vercel.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.post('/api/clerk/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  const wh = new Webhook(secret);
  try {
    const payload = wh.verify(req.body, {
      "svix-id": req.headers["svix-id"],
      "svix-timestamp": req.headers["svix-timestamp"],
      "svix-signature": req.headers["svix-signature"],
    });
    const { type, data } = payload;
    console.log('Webhook received:', type);

    if (type === 'user.created') {
      await prisma.user.create({
        data: {
          id: data.id,
          email: data?.email_addresses[0]?.email_address,
          name: data?.first_name + " " + data?.last_name,
          image: data?.image_url,
        },
      });
    } else if (type === 'user.updated') {
      await prisma.user.update({
        where: { id: data.id },
        data: {
          email: data?.email_addresses[0]?.email_address,
          name: data?.first_name + " " + data?.last_name,
          image: data?.image_url,
        },
      });
    } else if (type === 'user.deleted') {
      await prisma.user.delete({ where: { id: data.id } });
    } else if (type === 'organization.created') {
      await prisma.workspace.create({
        data: {
          id: data.id,
          name: data.name,
          slug: data.slug,
          ownerId: data.created_by,
          image_url: data.image_url,
        },
      });
      await prisma.workspaceMember.create({
        data: {
          userId: data.created_by,
          workspaceId: data.id,
          role: "ADMIN",
        },
      });
    } else if (type === 'organization.updated') {
      await prisma.workspace.update({
        where: { id: data.id },
        data: {
          name: data.name,
          slug: data.slug,
          image_url: data.image_url,
        },
      });
    } else if (type === 'organization.deleted') {
      await prisma.workspace.delete({ where: { id: data.id } });
    } else if (type === 'organizationMembership.created') {
      await prisma.workspaceMember.create({
        data: {
          userId: data.public_user_data.user_id,
          workspaceId: data.organization.id,
          role: String(data.role).toUpperCase(),
        },
      });
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

app.use(express.json());
app.use(clerkMiddleware());

app.get('/', (req, res) => res.send('Server is running 🚀🚀🚀🚀!!!!'));
app.use("/api/inngest", serve({ client: inngest, functions }));
app.use('/api/workspaces', protect, workspaceRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server is running on port 🚀🚀🚀 ${PORT}`));