#!/bin/bash

# pushd to the project root directory (adjust if this script is located elsewhere)
pushd `git rev-parse --show-toplevel` || exit

echo "🚀 Running npm install..."
npm install 

# Capture the exit status code of npm install immediately
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Success: npm install completed with NO failures."
    # Put commands here that should run next (like deploying or starting services)
else
    echo "❌ Critical: npm install encountered failures (Exit Code: $EXIT_CODE)."
    exit $EXIT_CODE
fi

 # Build the application
echo "🚀 Running automated npm build..."
npm run build

# Capture the exit status code of npm build immediately
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Success: npm build completed with NO failures."
    # Put commands here that should run next (like deploying or starting services)
else
    echo "❌ Critical: npm build encountered failures (Exit Code: $EXIT_CODE)."
    popd
    exit $EXIT_CODE
fi
# Initialize the database
 echo "🚀 Re-initializing database..."
 reinit-db.sh

# Capture the exit status code of reinit-db.sh immediately
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Success: Re-initialization completed with NO failures."
    # Put commands here that should run next (like deploying or starting services)
else
    echo "❌ Critical: Re-initialization encountered failures (Exit Code: $EXIT_CODE)."
    popd
    exit $EXIT_CODE
fi

 # Run tests with verbose output and without watch mode
echo "🚀 Running automated test suite..."
npm run test -- --watch=false

# Capture the exit status code of npm test immediately
TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ Success: Test suite completed with NO failures."
    # Put commands here that should run next (like deploying or starting services)
else
    echo "❌ Critical: Test suite encountered failures (Exit Code: $TEST_EXIT_CODE)."
    popd
    exit $TEST_EXIT_CODE
fi

 # Start the application (uncomment if you want to start the app after tests)
echo "🚀 Running SAROPs..."
npm run dev
