# TaskPay v2

Full-stack rewards platform — users complete tasks to earn points, redeem via PayPal.

## Stack
- **Backend**: Node.js + Express
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: JWT + bcryptjs (rate-limited)
- **Admin Panel**: AdminJS (auto-generated CRUD)
- **Frontend**: Tabler UI (Bootstrap 5)

## Quick Start (Cloud — No Local Install Needed)

### 1. Get a Free Database
- Go to [neon.tech](https://neon.tech) → Sign up with GitHub → Create project
- Copy the **Connection String** (starts with `postgresql://...`)

### 2. Deploy to Render
- Push this repo to GitHub
- Go to [render.com](https://render.com) → New → Web Service → Connect your repo
- Set these environment variables in Render dashboard:
  ```
  DATABASE_URL       = (your Neon connection string)
  JWT_SECRET         = (any long random string)
  SESSION_SECRET     = (any different long random string)
  ADMIN_EMAIL        = your-admin@email.com
  ADMIN_PASSWORD     = YourStrongPassword123!
  NODE_ENV           = production
  ```
- Build Command: `npm install && npx prisma generate && npx prisma db push`
- Start Command: `npm start`
- Click **Deploy** — your app is live!

### 3. Access the Admin Panel
Visit: `https://your-app.onrender.com/admin`

## Points System
- **100 points = $1.00**
- **Minimum withdrawal: 500 points ($5.00)**
- Task verification: users must click the task link, wait 30 seconds, THEN mark as done
- One pending withdrawal at a time per user

## API Endpoints
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /api/auth/register | — | Create account |
| POST | /api/auth/login | — | Login, returns JWT |
| GET | /api/auth/me | JWT | Get current user |
| GET | /api/tasks | JWT | List all active tasks |
| POST | /api/tasks/:id/click | JWT | Record task link click |
| POST | /api/tasks/:id/complete | JWT | Complete task (30s after click) |
| GET | /api/withdrawals | JWT | Get user's withdrawals |
| POST | /api/withdrawals | JWT | Submit withdrawal request |
