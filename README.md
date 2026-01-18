# TRUB.AI v2

Modern microservices architecture for the TRUB.AI trumpet practice assistant.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│   Audio     │
│  React +TS  │     │  Node.js +  │     │  Service    │
│   + Vite    │     │  Express    │     │  Python +   │
│             │     │             │     │  FastAPI    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ PostgreSQL  │
                    │  Database   │
                    └─────────────┘
```

## Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **HTTP Client**: Axios
- **WebSockets**: Socket.io-client
- **Routing**: React Router v6

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Language**: TypeScript
- **ORM**: TypeORM
- **Database**: PostgreSQL 15
- **Auth**: JWT
- **WebSockets**: Socket.io

### Audio Service
- **Runtime**: Python 3.11
- **Framework**: FastAPI
- **Audio Libraries**: librosa, numpy, scipy, soundfile, pydub
- **Server**: Uvicorn

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Database**: PostgreSQL 15-alpine

## Getting Started

### Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose)
- Git

### Initial Setup

1. **Clone the repository** (if not already)
   ```bash
   cd TRUB.AI
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

3. **Update environment variables** (optional)

   Edit `.env` file to customize:
   - Database credentials
   - JWT secret (IMPORTANT for production!)
   - API URLs

### Running the Application

#### Start all services
```bash
docker-compose up
```

#### Start in detached mode (background)
```bash
docker-compose up -d
```

#### View logs
```bash
docker-compose logs -f
```

#### Stop all services
```bash
docker-compose down
```

#### Rebuild after dependency changes
```bash
docker-compose up --build
```

## Service Access

Once running, access the services at:

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Audio Service**: http://localhost:8001
- **PostgreSQL**: localhost:5432

### Health Checks

- Backend: http://localhost:3000/health
- Audio Service: http://localhost:8001/health

## Development

### Directory Structure

```
/
├── backend/               # Node.js Backend API
│   ├── src/
│   │   └── index.ts      # Entry point
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── audio-service/         # Python Audio Service
│   ├── main.py           # FastAPI app
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/              # React Frontend
    ├── src/
    │   ├── main.tsx      # Entry point
    │   ├── App.tsx       # Main component
    │   └── index.css     # Global styles
    ├── public/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts
    └── .env.example
```

### Hot Reload

All services are configured with hot reload for development:

- **Backend**: Changes to `src/**/*.ts` automatically restart the server (nodemon)
- **Frontend**: Vite HMR - instant updates in the browser
- **Audio Service**: Uvicorn with `--reload` flag

### Installing New Dependencies

#### Backend
```bash
cd ./backend
npm install <package-name>
docker-compose up --build backend
```

#### Frontend
```bash
cd ./frontend
npm install <package-name>
docker-compose up --build frontend
```

#### Audio Service
```bash
# Add to ./audio-service/requirements.txt
docker-compose up --build audio-service
```

## Database

### Connection Details

- **Host**: postgres (internal) / localhost (external)
- **Port**: 5432
- **Database**: trubai
- **User**: trubai_user
- **Password**: trubai_pass (default - change in production!)

### Accessing PostgreSQL

```bash
# Using Docker
docker-compose exec postgres psql -U trubai_user -d trubai

# Using local client
psql -h localhost -U trubai_user -d trubai
```

### Data Persistence

Database data is stored in a Docker volume named `postgres-data` and persists across container restarts.

## API Documentation

### Backend API

Once running, explore the API:

- Root: http://localhost:3000
- Health: http://localhost:3000/health
- API routes: http://localhost:3000/api

### Audio Service API

- Root: http://localhost:8001
- Health: http://localhost:8001/health
- Docs: http://localhost:8001/docs (FastAPI auto-generated)
- Info: http://localhost:8001/api/info

## Troubleshooting

### Services won't start

1. **Check Docker is running**
   ```bash
   docker ps
   ```

2. **Check logs for errors**
   ```bash
   docker-compose logs <service-name>
   ```

3. **Clean rebuild**
   ```bash
   docker-compose down -v
   docker-compose up --build
   ```

### Port conflicts

If ports 3000, 5173, 8001, or 5432 are in use, update `docker-compose.yml`:

```yaml
services:
  backend:
    ports:
      - "3001:3000"  # Change external port
```

### Database connection errors

1. Wait for PostgreSQL to be ready (health check)
2. Verify DATABASE_URL in `.env`
3. Check network connectivity: `docker-compose logs postgres`

### Hot reload not working

**Windows users**: If hot reload doesn't work, ensure:
- WSL 2 backend is enabled in Docker Desktop
- Files are not on a Windows network drive
- Polling is enabled (already configured in vite.config.ts)

## Production Deployment

### Building for Production

#### Frontend
```bash
cd ./frontend
npm run build
```

#### Backend
```bash
cd ./backend
npm run build
```

### Production Docker Images

Use the production target in Dockerfiles:

```bash
docker build --target production -t trubai-frontend ./frontend
docker build --target production -t trubai-backend ./backend
```

### Environment Variables

Before deploying:
1. Generate a secure JWT secret: `openssl rand -base64 32`
2. Update database credentials
3. Set `NODE_ENV=production`
4. Configure CORS_ORIGINS appropriately

## Next Steps


### Phase 2: Core Backend
- [x] User authentication (register/login)
- [x] Database models with TypeORM
- [x] JWT middleware
- [x] CRUD endpoints

### Phase 3: Audio Service
- [x] Audio upload endpoint
- [x] Basic audio processing
- [x] Integration with backend

### Phase 4: Frontend
- [x] Authentication UI
- [x] Dashboard layout
- [x] Audio recording component

### Phase 5: Improvements
- [ ] Note validation improvements
- [ ] UI/UX improvements on Play Along Feature
- [ ] Song library enrichments
- - [ ] Practice session UI

### Phase 6: Integration
- [ ] End-to-end testing
- [ ] WebSocket integration
- [ ] File upload flow

## Contributing

When making changes:
1. Work in feature branches
2. Test locally with Docker Compose
3. Update documentation as needed
4. Ensure all services start without errors

## License

MIT
