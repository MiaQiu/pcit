#!/bin/bash
# Start SSH tunnel to production database via AWS Systems Manager
# This creates a tunnel from localhost:5433 to the production AWS RDS database in Singapore
# Uses port 5433 locally to avoid conflict with the dev tunnel on port 5432

set -e

echo "🔧 Starting SSH tunnel to production database..."
echo ""
echo "This will forward:"
echo "  localhost:5433 → nora-prod.cjy4ccwg2d5q.ap-southeast-1.rds.amazonaws.com:5432"
echo ""
echo "Press Ctrl+C to stop the tunnel when done."
echo ""

# Start the tunnel
aws ssm start-session \
  --target i-00d40d120d983d90c \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["nora-prod.cjy4ccwg2d5q.ap-southeast-1.rds.amazonaws.com"],"portNumber":["5432"],"localPortNumber":["5433"]}' \
  --region ap-southeast-1
