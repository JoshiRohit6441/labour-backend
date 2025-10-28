# LabourHire Frontend

A modern React application for connecting customers with skilled daily workers and contractors.

## Features

### For Users (Customers)
- Create and manage job requests (Immediate, Scheduled, or Bidding)
- View and accept quotes from contractors
- Real-time job tracking with location updates
- Payment processing with Razorpay
- Rating and review system
- Job history and analytics

### For Contractors
- Browse nearby job opportunities
- Submit quotes for jobs
- Manage workers and their availability
- Track earnings and payment history
- Real-time job notifications
- Business profile management

## Tech Stack

- **React 18** - UI library
- **Vite** - Build tool and dev server
- **React Router v6** - Client-side routing
- **Axios** - HTTP client
- **Socket.io Client** - Real-time communication
- **Lucide React** - Icon library
- **React Hot Toast** - Toast notifications
- **Date-fns** - Date utilities

## Project Structure

```
frontend/
├── src/
│   ├── components/       # Reusable UI components
│   │   └── Layout.jsx    # Main layout with sidebar
│   ├── contexts/         # React contexts
│   │   └── AuthContext.jsx
│   ├── pages/
│   │   ├── auth/         # Authentication pages
│   │   ├── user/         # User/customer pages
│   │   ├── contractor/   # Contractor pages
│   │   └── LandingPage.jsx
│   ├── services/         # API and Socket services
│   │   ├── api.js
│   │   └── socket.js
│   ├── App.jsx           # Main app component with routes
│   ├── main.jsx          # App entry point
│   └── index.css         # Global styles
├── index.html
├── vite.config.js
└── package.json
```

## Installation

### Prerequisites

- Node.js 18+ and npm
- Running backend server (see backend README)

### Setup

1. **Install dependencies:**

```bash
cd frontend
npm install
```

2. **Configure environment variables:**

Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:5000
```

3. **Start the development server:**

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Key Features Implementation

### Authentication

- Phone-based registration and login
- OTP verification
- JWT token management with refresh tokens
- Role-based access control (User/Contractor)

### Real-time Features

- Job status updates via Socket.io
- Live location tracking during active jobs
- Real-time notifications
- Chat functionality (ready for implementation)

### Responsive Design

- Mobile-first approach
- Responsive sidebar navigation
- Adaptive grid layouts
- Touch-friendly UI components

## API Integration

The frontend communicates with the backend via REST APIs:

### User Endpoints
- `POST /api/user/auth/register` - Register new user
- `POST /api/user/auth/login` - Login
- `POST /api/user/auth/verify-otp` - Verify OTP
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update profile
- `POST /api/user/jobs` - Create job
- `GET /api/user/jobs` - List user jobs
- `GET /api/user/jobs/:id` - Get job details
- `POST /api/user/jobs/:jobId/quotes/:quoteId/accept` - Accept quote

### Contractor Endpoints
- `GET /api/contractor/profile` - Get contractor profile
- `POST /api/contractor/profile` - Create/update profile
- `GET /api/contractor/nearby-jobs` - Browse nearby jobs
- `POST /api/contractor/jobs/:jobId/quotes` - Submit quote
- `GET /api/contractor/workers` - List workers
- `POST /api/contractor/workers` - Add worker
- `GET /api/contractor/payments/earnings` - Get earnings

## Design System

### Color Scheme

- Primary: Blue gradient (#667eea to #764ba2)
- Secondary: Green (#10b981)
- Danger: Red (#ef4444)
- Warning: Orange (#f59e0b)

### Components

All UI components follow consistent design patterns:
- Buttons with hover effects and loading states
- Input fields with focus states
- Cards with shadow and border
- Badges for status indicators
- Modal dialogs for forms

## State Management

- **AuthContext**: Global authentication state
- **Local State**: Component-level state with useState
- **API Cache**: Automatic refetching on mount

## Socket.io Integration

Real-time features are implemented using Socket.io:

```javascript
import socketService from './services/socket';

// Connect
socketService.connect();

// Join job room
socketService.joinJobRoom(jobId);

// Listen for updates
socketService.on('job_update', (data) => {
  // Handle update
});

// Send location
socketService.sendLocation(jobId, { lat, lng });
```

## Production Build

1. **Build the application:**

```bash
npm run build
```

2. **Serve the built files:**

The `dist` folder contains the production-ready files. Serve them using any static file server.

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

When adding new features:

1. Follow the existing code structure
2. Use functional components with hooks
3. Implement proper error handling
4. Add loading states
5. Ensure responsive design
6. Test on multiple screen sizes

## Troubleshooting

### CORS Issues

If you encounter CORS errors, ensure the backend is configured to allow requests from `http://localhost:3000`:

```javascript
// Backend: index.js
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));
```

### Socket.io Connection Issues

Check that:
- Backend server is running
- Socket.io is initialized on backend
- Correct URL is configured in `.env`

### API Request Failures

- Verify backend is running on correct port
- Check network tab in browser DevTools
- Ensure JWT token is valid
- Check backend logs for errors

## License

This project is part of the LabourHire platform.
