# Time Tracker Application

A full-stack time tracking application built with React and Go, designed for freelancers and remote workers to track their time, manage projects, and generate invoices.
You can also contribute in this repository

## Features

- 👤 User authentication with JWT
- ⏱️ Project-based time tracking with start/stop timer
- 📊 Visual analytics (daily/weekly/monthly)
- 💰 Multiple hourly rates for different projects
- 📋 Task management with categorization and tagging
- 📄 Invoice generation with PDF export
- 📱 Responsive design for mobile and desktop

## Tech Stack

### Frontend
- React with TypeScript
- TailwindCSS for styling
- Shadcn UI components
- React Query for data fetching
- React Router for navigation
- Chart.js for visualizations
- jsPDF for invoice generation

### Backend
- Go (Golang)
- Gin web framework
- GORM for database operations
- PostgreSQL database
- JWT for authentication


## Screenshot

<table>
    <tr>
        <td>
            <img src="images/image.png" />
            List Project
        </td>
        <td>
            <img src="images/image1.png" />
            Add Project
        </td>
    </tr>
    <tr>
        <td>
            <img src="images/image4.png" />
            List Task
        </td>
        <td>
            <img src="images/image5.png" />
            Add Task
        </td>
    </tr>
    <tr>
        <td>
            <img src="images/image2.png" />
            Detail Time Tracking by Task
        </td>
        <td>
            <img src="images/image3.png" />
            Time Tracking Dashboard
        </td>
    </tr>
    <tr>
        <td>
            <img src="images/image6.png" />
            Analytics Daily, Weekly, and Monthly
        </td>
        <td>
            <img src="images/image7.png" />
            Generate Report based Start Date and End Date
        </td>
    </tr>
    <tr>
        <td>
            <img src="images/image8.png" />
            PDF Report Invoice
        </td>
    </tr>
</table>

## Prerequisites

Before you begin, ensure you have installed:

- Node.js (v18 or later)
- Go (v1.19 or later)
- PostgreSQL (v12 or later)

## Getting Started

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install Go dependencies:
```bash
go mod tidy
```

3. Create a `.env` file:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/timetracker?sslmode=disable
JWT_SECRET=your-secret-key
PORT=8080
```

4. Create the database:
```sql
CREATE DATABASE timetracker;
```

5. Run the server:
```bash
go run cmd/main.go
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd client
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```env
VITE_API_URL=http://localhost:8080/api
```

4. Start the development server:
```bash
npm run dev
```

## Project Structure

```
├── backend/
│   ├── cmd/
│   │   └── main.go
│   ├── internal/
│   │   ├── config/
│   │   ├── models/
│   │   ├── handlers/
│   │   ├── middleware/
│   │   └── utils/
│   └── README.md
│
└── client/
    ├── src/
    │   ├── api/
    │   ├── components/
    │   ├── contexts/
    │   ├── features/
    │   ├── hooks/
    │   └── lib/
    └── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Time Entries
- `GET /api/time-entries` - List time entries
- `POST /api/time-entries` - Create time entry
- `PUT /api/time-entries/:id` - Update time entry
- `DELETE /api/time-entries/:id` - Delete time entry

### Tasks
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Analytics
- `GET /api/analytics/daily` - Get daily analytics
- `GET /api/analytics/weekly` - Get weekly analytics
- `GET /api/analytics/monthly` - Get monthly analytics

### Invoices
- `POST /api/invoices/generate` - Generate invoice

## Available Scripts

### Backend
```bash
# Run server
go run cmd/main.go

# Run tests
go test ./...
```

### Frontend
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Shadcn UI](https://ui.shadcn.com/) for the beautiful UI components
- [Gin Web Framework](https://gin-gonic.com/) for the Go web framework
- [GORM](https://gorm.io/) for the ORM library
