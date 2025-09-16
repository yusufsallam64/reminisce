# DementiaFriend RAG System Setup Guide

This guide walks you through setting up the complete RAG (Retrieval-Augmented Generation) system for DementiaFriend, including the embedding service and MongoDB Atlas Vector Search.

## Prerequisites

- Node.js 18+ and npm
- Python 3.11+ and pip
- Docker and Docker Compose
- MongoDB Atlas account (M10+ cluster required for Vector Search)
- 4GB+ RAM (8GB recommended for local development)

## Step 1: MongoDB Atlas Vector Search Setup

### 1.1 Create Vector Search Index

1. Go to your MongoDB Atlas cluster
2. Navigate to "Search" → "Create Search Index"
3. Choose "JSON Editor" and use this configuration:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1024,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "userId"
    },
    {
      "type": "filter",
      "path": "contentType"
    },
    {
      "type": "filter",
      "path": "companionId"
    },
    {
      "type": "filter",
      "path": "metadata.tags"
    }
  ]
}
```

4. Set the index name to: `vector_search_index`
5. Select your database and collection: `dementiafriend-rag.documents`

### 1.2 Verify Index Creation

Wait for the index to be created (usually 5-10 minutes). You can check the status in the Atlas UI.

## Step 2: Environment Configuration

### 2.1 Main Application Environment

Update your `.env` file:

```env
# Existing variables...
MONGODB_URI=your_mongodb_atlas_connection_string
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your_nextauth_secret

# RAG System Configuration
EMBEDDING_SERVICE_URL=http://localhost:8080
```

### 2.2 Embedding Service Environment

Create `.env` file in the embedding service directory:

```bash
cd ../dementiafriend-embedding-service
cp .env.example .env
```

Edit `.env`:
```env
PORT=8080
HOST=0.0.0.0
MODEL_DEVICE=auto  # or 'cpu', 'cuda', 'mps'
LOG_LEVEL=info
```

## Step 3: Start the Embedding Service

### Option A: Docker (Recommended)

```bash
cd ../dementiafriend-embedding-service
docker-compose up -d
```

### Option B: Local Python

```bash
cd ../dementiafriend-embedding-service
pip install -r requirements.txt
python src/server.py
```

**Note**: The first startup will download the BGE-M3 model (~2GB), which may take 5-10 minutes.

## Step 4: Verify Embedding Service

Test the service is running:

```bash
# Health check
curl http://localhost:8080/health

# Test embedding generation
curl -X POST http://localhost:8080/embed \
  -H "Content-Type: application/json" \
  -d '{"texts": ["Hello world"]}'
```

Expected response:
```json
{
  "status": "healthy",
  "model": "BAAI/bge-m3",
  "version": "1.0.0",
  "uptime": 123.45
}
```

## Step 5: Start Main Application

```bash
cd dementiafriend
npm install
npm run dev
```

The application will be available at: http://localhost:3001

## Step 6: Test RAG System Integration

Run the comprehensive integration test:

```bash
npm run test:rag
```

This test will:
- Verify embedding service connectivity
- Test document ingestion
- Validate semantic search
- Check RAG context building

Expected output:
```
🚀 Starting RAG System Integration Test

1️⃣ Testing system health...
   Status: healthy
   Embedding Service: ✅

2️⃣ Testing document addition...
   ✅ Added "Family Picnic Memory" (2 chunks)
   ✅ Added "Cooking with Grandma" (1 chunks)
   ✅ Added "First Day of School" (2 chunks)

3️⃣ Testing semantic search...
   Query: "family activities outdoors"
   Found 2 relevant documents:
     1. "Family Picnic Memory" (score: 0.892)
     2. "Cooking with Grandma" (score: 0.734)

🎉 All RAG system tests completed successfully!
```

## Step 7: API Testing

Test the RAG API endpoints:

### Add Document
```bash
curl -X POST http://localhost:3001/api/rag/add-document \
  -H "Content-Type: application/json" \
  -H "Cookie: your_session_cookie" \
  -d '{
    "title": "Test Memory",
    "content": "This is a test memory about a beautiful sunset.",
    "contentType": "memory",
    "tags": ["test", "sunset"]
  }'
```

### Search Documents
```bash
curl -X POST http://localhost:3001/api/rag/search \
  -H "Content-Type: application/json" \
  -H "Cookie: your_session_cookie" \
  -d '{
    "query": "beautiful sunset",
    "limit": 5
  }'
```

### Health Check
```bash
curl http://localhost:3001/api/rag/health
```

## Troubleshooting

### Common Issues

#### 1. Embedding Service Not Starting
- **Issue**: Service fails to start or takes too long
- **Solutions**:
  - Check available disk space (need ~2GB for model)
  - Verify internet connection for model download
  - Check Python dependencies: `pip install -r requirements.txt`
  - For memory issues, use CPU: `MODEL_DEVICE=cpu`

#### 2. Vector Search Not Working
- **Issue**: Search returns no results or errors
- **Solutions**:
  - Verify MongoDB Atlas Vector Search index is created and active
  - Check cluster tier (M10+ required for Vector Search)
  - Ensure index name matches: `vector_search_index`
  - Verify database/collection names match

#### 3. Connection Errors
- **Issue**: Cannot connect to embedding service
- **Solutions**:
  - Check service is running: `curl http://localhost:8080/health`
  - Verify EMBEDDING_SERVICE_URL in .env
  - Check firewall/port access
  - Review Docker logs: `docker-compose logs embedding-service`

#### 4. Authentication Issues
- **Issue**: API endpoints return 401 Unauthorized
- **Solutions**:
  - Ensure you're logged in to the application
  - Check NextAuth configuration
  - Verify session cookies are included in requests

### Performance Optimization

#### For Better Performance:
1. **GPU Acceleration**: Set `MODEL_DEVICE=cuda` if you have NVIDIA GPU
2. **Apple Silicon**: Set `MODEL_DEVICE=mps` for M1/M2 Macs
3. **Memory**: Allocate more RAM to Docker if using containers
4. **Batch Size**: Process multiple documents at once

#### Monitoring:
1. **Service Health**: `GET /api/rag/health`
2. **Embedding Service**: `GET http://localhost:8080/health`
3. **MongoDB Metrics**: Check Atlas monitoring dashboard
4. **Application Logs**: Check Next.js console output

## Production Deployment

### Security Considerations
1. **Environment Variables**: Use secure secret management
2. **API Access**: Implement rate limiting
3. **Network**: Use HTTPS and proper firewall rules
4. **Database**: Enable MongoDB Atlas security features

### Scaling Recommendations
1. **Embedding Service**: Use multiple replicas behind load balancer
2. **MongoDB**: Use appropriate cluster tier for your usage
3. **Caching**: Consider Redis for frequently accessed data
4. **Monitoring**: Set up alerts for service health and performance

## Next Steps

After successful setup:

1. **Integrate with AI Conversations**: Use RAG context in chat responses
2. **Document Upload**: Add file upload functionality
3. **Advanced Search**: Implement hybrid search and filters
4. **Analytics**: Track search quality and user behavior
5. **Optimization**: Fine-tune chunking and search parameters

## Support

For issues:
1. Check the logs: `docker-compose logs` or application console
2. Review the API documentation in the README files
3. Test individual components using the provided curl commands
4. Ensure all prerequisites and dependencies are properly installed