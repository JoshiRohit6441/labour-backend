# Quick Start Guide - LabourHire Platform

## 🚀 Get Started in 5 Minutes

### Prerequisites
- Node.js 18+ installed
- PostgreSQL database running
- Git installed

### Step 1: Backend Setup (2 minutes)

```bash
# Install backend dependencies
npm install

# Configure environment
cp env.example .env
# Edit .env with your database credentials

# Run database migrations
npm run db:push

# Start backend server
npm run dev
```

Backend will run on `http://localhost:5000`

### Step 2: Frontend Setup (2 minutes)

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# .env should have: VITE_API_URL=http://localhost:5000

# Start frontend server
npm run dev
```

Frontend will run on `http://localhost:3000`

### Step 3: Test the Application (1 minute)

1. **Open browser**: `http://localhost:3000`

2. **Register as User**:
   - Click "Get Started"
   - Fill form, select "User - Need Workers"
   - Submit (OTP will be in backend console logs)

3. **Create a Job**:
   - After login, click "Create Job"
   - Fill job details
   - Submit

4. **Register as Contractor** (open incognito/new browser):
   - Register with "Contractor - Provide Workers" role
   - Complete business profile
   - Add workers
   - Browse nearby jobs
   - Submit quote

## 🎯 Key URLs

- **Landing Page**: `http://localhost:3000`
- **User Dashboard**: `http://localhost:3000/user/dashboard`
- **Contractor Dashboard**: `http://localhost:3000/contractor/dashboard`
- **Backend Health**: `http://localhost:5000/health`
- **Backend API**: `http://localhost:5000/api`

## 📱 Test Credentials

### For Testing (Development Only)

Create accounts with any phone number (10 digits):
- **User Account**: Phone: 9876543210, Role: USER
- **Contractor Account**: Phone: 9876543211, Role: CONTRACTOR

OTP will appear in backend console logs.

## 🔧 Common Commands

### Backend
```bash
npm run dev              # Start development server
npm run db:push          # Push schema changes
npm run db:studio        # Open Prisma Studio
npm run db:migrate       # Create migration
```

### Frontend
```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run preview          # Preview production build
```

## ✨ Features Available

### User Portal
- ✅ Create jobs (Immediate/Scheduled/Bidding)
- ✅ View and accept quotes
- ✅ Track job status
- ✅ Payment history
- ✅ Profile management

### Contractor Portal
- ✅ Browse nearby jobs
- ✅ Submit quotes
- ✅ Manage workers
- ✅ Track earnings
- ✅ Business profile

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check database connection
# Verify DATABASE_URL in .env
# Ensure PostgreSQL is running
```

### Frontend can't connect
```bash
# Verify backend is running on port 5000
# Check VITE_API_URL in frontend/.env
# Look for CORS errors in browser console
```

### OTP not appearing
```bash
# Check backend console logs for OTP
# In development, OTP is logged to console
# For production, configure Twilio in .env
```

## 📚 Documentation

- **Full Setup Guide**: See `FRONTEND_SETUP.md`
- **Frontend README**: See `frontend/README.md`
- **Backend README**: See `README.md`

## 🎨 Architecture

```
┌─────────────────┐
│   React App     │  Port 3000
│   (Frontend)    │
└────────┬────────┘
         │
    HTTP + WS
         │
┌────────▼────────┐
│  Express API    │  Port 5000
│   (Backend)     │
└────────┬────────┘
         │
    Prisma
         │
┌────────▼────────┐
│  PostgreSQL     │  Port 5432
│   (Database)    │
└─────────────────┘
```

## 🚀 Next Steps

1. **Explore the UI**: Try both user and contractor portals
2. **Create sample data**: Add jobs, workers, and quotes
3. **Test workflows**: Complete end-to-end job flow
4. **Customize**: Modify colors, add features, etc.
5. **Deploy**: Follow deployment guide in `FRONTEND_SETUP.md`

## 💡 Tips

- Use browser DevTools Network tab to debug API calls
- Check browser console for frontend errors
- Check terminal for backend errors
- Use Prisma Studio to view/edit database directly: `npm run db:studio`

## 🌟 Ready to Go!

Your full-stack labour hiring platform is now running!

Start by creating a user account, posting a job, then create a contractor account to submit a quote. The entire workflow is functional and ready for customization.

Happy coding! 🎉
