"""
Test script to verify environment variables are loaded correctly.
Run this to check if your .env file is being read.
"""
import os
from pathlib import Path

print("=" * 60)
print("LLM Service Environment Test")
print("=" * 60)
print()

# Check if .env file exists
env_file = Path(__file__).parent / ".env"
print(f"1. Checking .env file: {env_file}")
if env_file.exists():
    print("   ✅ .env file exists")
    print(f"   File size: {env_file.stat().st_size} bytes")
else:
    print("   ❌ .env file NOT found!")
    print("   Create it from .env.example")
    exit(1)

print()

# Try loading with python-dotenv
try:
    from dotenv import load_dotenv
    load_dotenv(env_file)
    print("2. Loading environment variables with python-dotenv")
    print("   ✅ Loaded successfully")
except ImportError:
    print("2. python-dotenv not installed (will use os.environ)")
    print("   ⚠️  Variables must be set in shell environment")

print()

# Check GROQ_API_KEY
groq_key = os.getenv("GROQ_API_KEY", "")
print("3. Checking GROQ_API_KEY:")
if groq_key:
    # Show first and last 4 characters only
    if len(groq_key) > 12:
        masked = f"{groq_key[:4]}...{groq_key[-4:]}"
    else:
        masked = "***"
    print(f"   ✅ GROQ_API_KEY is set: {masked}")
    print(f"   Length: {len(groq_key)} characters")

    # Check format
    if groq_key.startswith("gsk_"):
        print("   ✅ Correct format (starts with gsk_)")
    else:
        print("   ⚠️  Warning: Should start with 'gsk_'")
else:
    print("   ❌ GROQ_API_KEY is NOT set!")
    print("   Add it to your .env file")
    exit(1)

print()

# Check other variables
print("4. Other configuration:")
print(f"   GROQ_MODEL: {os.getenv('GROQ_MODEL', 'mixtral-8x7b-32768')}")
print(f"   GROQ_TEMPERATURE: {os.getenv('GROQ_TEMPERATURE', '0.7')}")
print(f"   GROQ_MAX_TOKENS: {os.getenv('GROQ_MAX_TOKENS', '2048')}")

print()

# Try importing Groq SDK
print("5. Testing Groq SDK import:")
try:
    from groq import Groq
    print("   ✅ Groq SDK imported successfully")

    # Check version
    try:
        import groq
        version = groq.__version__ if hasattr(groq, '__version__') else "unknown"
        print(f"   Version: {version}")
    except:
        print("   Version: unknown")

except ImportError as e:
    print(f"   ❌ Failed to import Groq SDK: {e}")
    print("   Run: pip install groq==0.9.0")
    exit(1)

print()

# Try initializing Groq client
print("6. Testing Groq client initialization:")
try:
    from groq import Groq
    client = Groq(api_key=groq_key, timeout=10.0, max_retries=1)
    print("   ✅ Groq client initialized successfully")
except Exception as e:
    print(f"   ❌ Failed to initialize client: {e}")
    print(f"   Error type: {type(e).__name__}")
    exit(1)

print()
print("=" * 60)
print("✅ All checks passed! Environment is configured correctly.")
print("=" * 60)
print()
print("Your LLM service should work now.")
print("Start with: uvicorn main:app --host 0.0.0.0 --port 8002 --reload")
