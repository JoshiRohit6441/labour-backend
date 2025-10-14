# LabourHireApp Backend API

A comprehensive backend API for a daily labor hiring marketplace built with Node.js, Express.js, and PostgreSQL.

## 🚀 Features

- **Multi-role Authentication**: Support for Admin, Staff, Contractor, User, and Guest roles
- **Job Management**: Create, manage, and track jobs with bidding and immediate hiring options
- **Real-time Communication**: Socket.io integration for live chat and location tracking
- **Payment Integration**: Razorpay integration for secure payments and escrow
- **Document Verification**: KYC and background check management
- **Notification System**: Real-time notifications via Socket.io and SMS/Email
- **Admin Dashboard**: Comprehensive admin panel for managing the platform
- **Rate Limiting & Security**: Built-in security measures and rate limiting

## 🏗️ Architecture

- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Real-time**: Socket.io
- **Authentication**: JWT with refresh tokens
- **Payments**: Razorpay
- **File Storage**: Cloudinary
- **SMS**: Twilio
- **Email**: Nodemailer
- **Caching**: Redis

## 📋 Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- Redis (v6 or higher)
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/JoshiRohit6441/labour-backend.git
   cd labour-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp env.example .env
   ```
   Update the `.env` file with your configuration values.

4. **Database Setup**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push schema to database
   npm run db:push
   
   # Or run migrations
   npm run db:migrate
   ```

5. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `JWT_SECRET` | Secret key for JWT tokens | ✅ |
| `REDIS_URL` | Redis connection string | ✅ |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | ✅ |
| `CLOUDINARY_API_KEY` | Cloudinary API key | ✅ |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | ✅ |
| `RAZORPAY_KEY_ID` | Razorpay key ID | ✅ |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret | ✅ |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | ✅ |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | ✅ |
| `TWILIO_PHONE_NUMBER` | Twilio phone number | ✅ |

## 📚 API Documentation

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/verify-otp` | Verify phone number |
| POST | `/api/auth/resend-otp` | Resend OTP |
| POST | `/api/auth/refresh-token` | Refresh access token |
| POST | `/api/auth/logout` | User logout |

### User Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/profile` | Get user profile |
| PUT | `/api/user/profile` | Update user profile |
| PUT | `/api/user/change-password` | Change password |
| DELETE | `/api/user/account` | Delete account |
| GET | `/api/user/jobs` | Get user's jobs |

### Contractor Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/contractor/profile` | Create contractor profile |
| GET | `/api/contractor/profile` | Get contractor profile |
| PUT | `/api/contractor/profile` | Update contractor profile |
| POST | `/api/contractor/workers` | Add worker |
| GET | `/api/contractor/workers` | Get workers |
| PUT | `/api/contractor/workers/:id` | Update worker |
| DELETE | `/api/contractor/workers/:id` | Delete worker |
| POST | `/api/contractor/rate-cards` | Create rate card |
| GET | `/api/contractor/rate-cards` | Get rate cards |
| GET | `/api/contractor/nearby-jobs` | Get nearby jobs |

### Job Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/jobs` | Create job |
| GET | `/api/jobs/:id` | Get job details |
| PUT | `/api/jobs/:id` | Update job |
| DELETE | `/api/jobs/:id` | Cancel job |
| POST | `/api/jobs/:id/quotes` | Submit quote |
| POST | `/api/jobs/:id/quotes/:quoteId/accept` | Accept quote |
| POST | `/api/jobs/:id/start` | Start job |
| POST | `/api/jobs/:id/complete` | Complete job |
| POST | `/api/jobs/:id/assign-workers` | Assign workers |

### Payment Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/create-order` | Create payment order |
| POST | `/api/payments/verify` | Verify payment |
| GET | `/api/payments/history` | Get payment history |
| GET | `/api/payments/:id` | Get payment details |
| POST | `/api/payments/:id/refund` | Initiate refund |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Get dashboard stats |
| GET | `/api/admin/users` | Get all users |
| GET | `/api/admin/contractors` | Get all contractors |
| GET | `/api/admin/jobs` | Get all jobs |
| GET | `/api/admin/verifications` | Get pending verifications |
| PUT | `/api/admin/verifications/:id` | Verify document |
| GET | `/api/admin/reports` | Get reports |

## 🔌 Socket.io Events

### Client to Server

| Event | Description | Data |
|-------|-------------|------|
| `join_job_room` | Join job-specific room | `{ jobId }` |
| `leave_job_room` | Leave job-specific room | `{ jobId }` |
| `location_update` | Send location update | `{ jobId, latitude, longitude, accuracy }` |
| `send_message` | Send chat message | `{ jobId, message, messageType, fileUrl }` |
| `typing_start` | Start typing indicator | `{ jobId }` |
| `typing_stop` | Stop typing indicator | `{ jobId }` |

### Server to Client

| Event | Description | Data |
|-------|-------------|------|
| `notification` | New notification | `{ id, type, title, message, data, sentAt }` |
| `job_update` | Job status update | `{ jobId, updateType, data, timestamp }` |
| `location_update` | Location update | `{ userId, jobId, latitude, longitude, accuracy, timestamp }` |
| `new_message` | New chat message | `{ id, chatRoomId, senderId, message, messageType, fileUrl, createdAt, sender }` |
| `user_typing` | User typing indicator | `{ userId, userName, isTyping }` |

## 🗄️ Database Schema

The application uses PostgreSQL with the following main entities:

- **Users**: User accounts with role-based access
- **Contractors**: Business profiles for service providers
- **Workers**: Individual workers under contractors
- **Jobs**: Job postings and assignments
- **Quotes**: Bidding system for jobs
- **Payments**: Payment tracking and escrow
- **Documents**: KYC and verification documents
- **Notifications**: System notifications
- **Chat**: Real-time messaging
- **Location Updates**: GPS tracking for jobs

## 🔒 Security Features

- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- Rate limiting on all endpoints
- Input validation and sanitization
- CORS protection
- Helmet.js security headers
- Password hashing with bcrypt
- OTP verification for phone numbers

## 🚀 Deployment

### Docker Deployment

1. **Build the image**
   ```bash
   docker build -t labour-backend .
   ```

2. **Run with docker-compose**
   ```bash
   docker-compose up -d
   ```

### Manual Deployment

1. **Install PM2**
   ```bash
   npm install -g pm2
   ```

2. **Start the application**
   ```bash
   pm2 start index.js --name labour-backend
   ```

3. **Setup reverse proxy with Nginx**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Run tests with coverage
npm run test:coverage
```

## 📝 API Examples

### Register User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "9876543210",
    "password": "password123",
    "role": "USER"
  }'
```

### Create Job
```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "House Cleaning",
    "description": "Need 2 workers for house cleaning",
    "jobType": "IMMEDIATE",
    "address": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "latitude": 19.0760,
    "longitude": 72.8777,
    "numberOfWorkers": 2,
    "requiredSkills": ["cleaning", "housekeeping"],
    "budget": 2000
  }'
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, email support@labourhire.com or create an issue in the repository.

## 🔄 Version History

- **v1.0.0** - Initial release with core functionality
- **v1.1.0** - Added real-time features and Socket.io
- **v1.2.0** - Enhanced payment integration and admin panel

---

Made with ❤️ for the labor community