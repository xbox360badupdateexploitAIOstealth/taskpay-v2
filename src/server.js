if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 }
}));

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/withdrawals', require('./routes/withdrawals'));

// AdminJS setup (async because it needs to import ESM)
async function setupAdmin() {
  const AdminJS = (await import('adminjs')).default;
  const AdminJSExpress = await import('@adminjs/express');
  const { PrismaClient } = require('@prisma/client');
  const { Database, Resource, getModelByName } = await import('@adminjs/prisma');

  const prisma = new PrismaClient();
  AdminJS.registerAdapter({ Database, Resource });

  const adminJs = new AdminJS({
    resources: [
      {
        resource: { model: getModelByName('User'), client: prisma },
        options: {
          navigation: { name: 'Users' },
          actions: {
            new: { isAccessible: true },
            edit: { isAccessible: true },
            delete: { isAccessible: true }
          },
          properties: {
            password: { isVisible: { list: false, show: false, edit: false, filter: false } }
          }
        }
      },
      {
        resource: { model: getModelByName('Task'), client: prisma },
        options: { navigation: { name: 'Tasks' } }
      },
      {
        resource: { model: getModelByName('Withdrawal'), client: prisma },
        options: {
          navigation: { name: 'Withdrawals' },
          properties: {
            status: {
              availableValues: [
                { value: 'PENDING', label: 'Pending' },
                { value: 'APPROVED', label: 'Approved' },
                { value: 'REJECTED', label: 'Rejected' }
              ]
            }
          }
        }
      },
      {
        resource: { model: getModelByName('TaskCompletion'), client: prisma },
        options: { navigation: { name: 'Completions' } }
      }
    ],
    branding: { companyName: 'TaskPay Admin', softwareBrothers: false },
    rootPath: '/admin'
  });

  const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
    authenticate: async (email, password) => {
      if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        return { email };
      }
      return null;
    },
    cookieName: 'taskpay-admin',
    cookiePassword: process.env.SESSION_SECRET || 'fallback-secret'
  });

  app.use('/admin', adminRouter);
  console.log(`AdminJS available at http://localhost:${PORT}/admin`);
}

// Serve static HTML files
app.use(express.static(path.join(__dirname, '../public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../public/dashboard.html')));

setupAdmin().then(() => {
  app.listen(PORT, () => console.log(`TaskPay running on port ${PORT}`));
}).catch(err => {
  console.error('Failed to start AdminJS:', err);
  app.listen(PORT, () => console.log(`TaskPay running on port ${PORT} (no admin panel)`));
});
