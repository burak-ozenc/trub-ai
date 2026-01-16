# TRUB.AI v2 - Quick Start Guide

Get up and running with TRUB.AI v2 in 3 simple steps!

## Step 1: Create Environment File

```bash
cp .env.example .env
```

**That's it!** The default values are ready for local development.

> **Optional**: Edit `.env` to customize database credentials or JWT secret

## Step 2: Start All Services

```bash
docker-compose up
```

This will:
- ✅ Start PostgreSQL database
- ✅ Start Node.js backend API (port 3000)
- ✅ Start Python audio service (port 8001)
- ✅ Start React frontend (port 5173)

**First run** will take a few minutes to download images and install dependencies.

## Step 3: Open Your Browser

```
http://localhost:5173
```

You should see the TRUB.AI v2 landing page with system status indicators.

## Verify Everything is Working

### Check Service Status

All services should show "Running" status on the frontend.

### Manual Health Checks

```bash
# Backend
curl http://localhost:3000/health

# Audio Service
curl http://localhost:8001/health
```

## What's Next?

### Development Workflow

1. **Edit code** - Changes hot reload automatically!
   - Backend: Edit `v2/backend/src/**/*.ts`
   - Frontend: Edit `v2/frontend/src/**/*`
   - Audio Service: Edit `v2/audio-service/**/*.py`

2. **View logs**
   ```bash
   docker-compose logs -f
   ```

3. **Stop services**
   ```bash
   docker-compose down
   ```

### Explore the API

- **Backend API**: http://localhost:3000/api
- **Audio Service Docs**: http://localhost:8001/docs

### Read Full Documentation

See `v2/README.md` for:
- Detailed architecture
- Development guides
- Troubleshooting
- Production deployment

## Common Issues

### Port Already in Use

If you see "port already allocated" errors:

1. Check what's using the ports:
   ```bash
   # Windows
   netstat -ano | findstr :3000
   netstat -ano | findstr :5173
   netstat -ano | findstr :8001
   netstat -ano | findstr :5432
   ```

2. Either stop the conflicting service or change ports in `docker-compose.yml`

### Services Won't Start

```bash
# Clean everything and rebuild
docker-compose down -v
docker-compose up --build
```

### Hot Reload Not Working (Windows)

Make sure:
- Docker Desktop is using WSL 2 backend
- Your code is not on a network drive

## Need Help?

- 📖 Read the full docs: `v2/README.md`
- 🐛 Check the logs: `docker-compose logs <service-name>`
- 🔍 Troubleshooting section in `v2/README.md`

---

**Ready to build something amazing!** 🎺✨
