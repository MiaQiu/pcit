#!/bin/sh
set -e

echo "Generating Prisma client..."
npx prisma generate

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting server..."
exec node server.cjs
