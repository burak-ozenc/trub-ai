#!/bin/bash

# Setup LocalStack S3 bucket for local development
# This script creates the S3 bucket used by TRUB.AI in LocalStack

BUCKET_NAME=${AWS_S3_BUCKET:-trubai-media-local}
ENDPOINT_URL=${AWS_ENDPOINT_URL:-http://localhost:4566}
REGION=${AWS_REGION:-us-east-1}

echo "🚀 Setting up LocalStack S3 bucket..."
echo "   Bucket: $BUCKET_NAME"
echo "   Endpoint: $ENDPOINT_URL"
echo "   Region: $REGION"

# Wait for LocalStack to be ready
echo ""
echo "⏳ Waiting for LocalStack to be ready..."
for i in {1..30}; do
  if curl -s "$ENDPOINT_URL/_localstack/health" > /dev/null 2>&1; then
    echo "✅ LocalStack is ready!"
    break
  fi
  echo "   Attempt $i/30..."
  sleep 2
done

# Check if bucket already exists
echo ""
echo "🔍 Checking if bucket exists..."
if aws --endpoint-url="$ENDPOINT_URL" s3 ls "s3://$BUCKET_NAME" 2>/dev/null; then
  echo "✅ Bucket '$BUCKET_NAME' already exists"
else
  echo "📦 Creating bucket '$BUCKET_NAME'..."
  aws --endpoint-url="$ENDPOINT_URL" \
    s3 mb "s3://$BUCKET_NAME" \
    --region "$REGION"

  if [ $? -eq 0 ]; then
    echo "✅ Bucket created successfully!"
  else
    echo "❌ Failed to create bucket"
    exit 1
  fi
fi

# Verify bucket exists
echo ""
echo "✅ Verifying bucket setup..."
aws --endpoint-url="$ENDPOINT_URL" s3 ls

echo ""
echo "🎉 LocalStack S3 setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Ensure your .env file has the correct AWS_* environment variables"
echo "   2. Start your backend service: cd services/backend && npm run dev"
echo "   3. Upload a test file to verify S3 integration works"
