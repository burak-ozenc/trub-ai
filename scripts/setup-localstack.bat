@echo off
REM Setup LocalStack S3 bucket for local development
REM This script creates the S3 bucket used by TRUB.AI in LocalStack

set BUCKET_NAME=trubai-storage
set ENDPOINT_URL=http://localhost:4566
set REGION=us-east-1

echo 🚀 Setting up LocalStack S3 bucket...
echo    Bucket: %BUCKET_NAME%
echo    Endpoint: %ENDPOINT_URL%
echo    Region: %REGION%

echo.
echo ⏳ Waiting for LocalStack to be ready...
timeout /t 5 /nobreak > nul

echo.
echo 📦 Creating bucket '%BUCKET_NAME%'...
aws --endpoint-url=%ENDPOINT_URL% s3 mb s3://%BUCKET_NAME% --region %REGION%

if %errorlevel% equ 0 (
    echo ✅ Bucket created successfully!
) else (
    echo ℹ️  Bucket may already exist or LocalStack is not running
)

echo.
echo ✅ Verifying bucket setup...
aws --endpoint-url=%ENDPOINT_URL% s3 ls

echo.
echo 🎉 LocalStack S3 setup complete!
echo.
echo 📝 Next steps:
echo    1. Ensure your .env file has the correct AWS_* environment variables
echo    2. Start your backend service: cd services\backend ^&^& npm run dev
echo    3. Upload a test file to verify S3 integration works
