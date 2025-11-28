#!/bin/bash
# Start SSH tunnel to development database via AWS Systems Manager
# This creates a tunnel from localhost:5432 to the AWS RDS database

set -e

echo "🔧 Starting SSH tunnel to development database..."
echo ""
echo "This will forward:"
echo "  localhost:5432 → nora-db-dev.cst6ygywo6de.us-east-1.rds.amazonaws.com:5432"
echo ""
echo "Press Ctrl+C to stop the tunnel when done."
echo ""

# Start the tunnel
aws ssm start-session \
  --target i-0816636c6667be898 \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["nora-db-dev.cst6ygywo6de.us-east-1.rds.amazonaws.com"],"portNumber":["5432"],"localPortNumber":["5432"]}' \
  --region us-east-1
