# Database Access Guide - nora-db

## Database Information

### Production Database
- **Endpoint:** `nora-db.cst6ygywo6de.us-east-1.rds.amazonaws.com:5432`
- **Database:** `nora`
- **Username:** `nora_admin`
- **Password:** See `aws-resources.txt` (DB_PASSWORD) or AWS Secrets Manager
- **Public Access:** ❌ NO (secure - private subnet only)
- **Used by:** AWS App Runner (production)

### Development Database
- **Endpoint:** `nora-db-dev.cst6ygywo6de.us-east-1.rds.amazonaws.com:5432`
- **Database:** `nora_dev`
- **Username:** `nora_admin`
- **Password:** See `aws-resources.txt` (DB_PASSWORD_DEV)
- **Public Access:** ❌ NO (secure - private subnet only)
- **Used by:** Local development environment

---

## Method 1: AWS Systems Manager + Bastion (Recommended) ✅

**Best for:** Quick queries, viewing data, testing, migrations
**Status:** ✅ Already Set Up (bastion instance: i-0816636c6667be898)

### Quick Start - Query via AWS Console

1. Go to: https://console.aws.amazon.com/systems-manager/session-manager?region=us-east-1
2. Click **"Start session"**
3. Select instance: **`nora-bastion`** (i-0816636c6667be898)
4. Click **"Start session"**
5. In the terminal, connect to the database:

**For Production Database:**
```bash
PGPASSWORD=FPEBKqGY6LU4IXsxM4quqJMxfPccZCsn psql -h nora-db.cst6ygywo6de.us-east-1.rds.amazonaws.com -U nora_admin -d nora
```

**For Development Database:**
```bash
PGPASSWORD=D7upDeIjZc1S1BG6Mca1QxKzVqxF4Bbw psql -h nora-db-dev.cst6ygywo6de.us-east-1.rds.amazonaws.com -U nora_admin -d nora_dev
```

6. You're now connected! 🎉

### Common Queries

Once connected to psql, try these commands:

```sql
-- List all tables
\dt

-- Describe a table structure
\d "User"

-- Count all records
SELECT
  'User' as table, COUNT(*) as count FROM "User"
UNION ALL SELECT 'Session', COUNT(*) FROM "Session"
UNION ALL SELECT 'RefreshToken', COUNT(*) FROM "RefreshToken"
UNION ALL SELECT 'LearningProgress', COUNT(*) FROM "LearningProgress"
UNION ALL SELECT 'ModuleHistory', COUNT(*) FROM "ModuleHistory"
UNION ALL SELECT 'WacbSurvey', COUNT(*) FROM "WacbSurvey";

-- View all users
SELECT id, email, name, "childName", "createdAt" FROM "User";

-- View recent sessions
SELECT id, "userId", mode, "durationSeconds", "createdAt"
FROM "Session"
ORDER BY "createdAt" DESC
LIMIT 10;

-- Check learning progress
SELECT lp.id, u.email, lp."currentDeck", lp."unlockedDecks", lp."updatedAt"
FROM "LearningProgress" lp
JOIN "User" u ON lp."userId" = u.id;

-- Exit psql
\q
```

### Running Migrations via Bastion

The bastion already has Node.js and Prisma installed:

```bash
# From your local machine, upload new migrations to S3
tar -czf /tmp/prisma-migrations.tar.gz prisma/
aws s3 cp /tmp/prisma-migrations.tar.gz s3://nora-audio-059364397483/migrations/ --region us-east-1

# Generate presigned URL
PRESIGNED_URL=$(aws s3 presign s3://nora-audio-059364397483/migrations/prisma-migrations.tar.gz --expires-in 300 --region us-east-1)

# Then in AWS Session Manager (connected to bastion):
cd /tmp
curl -o prisma-migrations.tar.gz "$PRESIGNED_URL"
tar -xzf prisma-migrations.tar.gz
cd prisma
export DATABASE_URL="postgresql://nora_admin:FPEBKqGY6LU4IXsxM4quqJMxfPccZCsn@nora-db.cst6ygywo6de.us-east-1.rds.amazonaws.com:5432/nora"
npx prisma migrate deploy
```

### Bastion Instance Details

- **Instance ID:** i-0816636c6667be898
- **Instance Type:** t3.micro (~$0.0104/hour = ~$7.50/month if left running)
- **Subnet:** Public subnet (subnet-0efbc747bd1d3ba95)
- **Security Group:** sg-0364406d185c3e293
- **Access Method:** AWS Systems Manager Session Manager (no SSH keys needed!)
- **Installed Software:**
  - PostgreSQL 15 client
  - Node.js 18.20.8
  - npm 10.8.2
  - Prisma 5.22.0

### Cost Management

**To save costs, you can stop the instance when not in use:**
```bash
# Stop bastion
aws ec2 stop-instances --instance-ids i-0816636c6667be898 --region us-east-1

# Start bastion when needed
aws ec2 start-instances --instance-ids i-0816636c6667be898 --region us-east-1
aws ec2 wait instance-running --instance-ids i-0816636c6667be898 --region us-east-1
```

**Or terminate it completely (can recreate later if needed):**
```bash
aws ec2 terminate-instances --instance-ids i-0816636c6667be898 --region us-east-1
```

---

## Method 2: Connect via App Runner (For Migrations)

**Best for:** Running Prisma migrations, seeding data

Since App Runner is in the VPC and can access the database:

1. **Run migrations:**
   ```bash
   # App Runner will automatically run this on deployment
   # Check logs to see if migrations ran:
   aws logs tail /aws/apprunner/nora-api/.../application \
     --region us-east-1 \
     --since 30m
   ```

2. **Manually trigger migrations:**
   Update your `server.cjs` to run migrations on startup:
   ```javascript
   const { PrismaClient } = require('@prisma/client');
   const prisma = new PrismaClient();

   // Run migrations on startup (development only)
   if (process.env.NODE_ENV !== 'production') {
     const { execSync } = require('child_process');
     execSync('npx prisma migrate deploy');
   }
   ```

---

## Method 3: RDS Proxy + Lambda (Production-Ready)

**Best for:** Scheduled queries, automated tasks

Create a Lambda function in the VPC that can query the database:

```javascript
// lambda/query-db.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.handler = async (event) => {
  try {
    // Query database
    const users = await prisma.user.count();
    const sessions = await prisma.session.count();

    return {
      statusCode: 200,
      body: JSON.stringify({ users, sessions })
    };
  } catch (error) {
    console.error('Database error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

---

## Security Notes

✅ **Current Setup (Secure):**
- Database is in **private subnet** (not publicly accessible)
- Only App Runner can access via VPC connector
- Encrypted at rest and in transit
- Credentials stored in AWS Secrets Manager

❌ **DON'T DO THIS (Insecure):**
- Enable public accessibility
- Allow 0.0.0.0/0 in security group
- Store credentials in code or .env files
- Leave bastion running 24/7

⚠️ **If You Need Regular Access:**
- Use RDS Query Editor (built-in, secure)
- Or set up AWS Client VPN (secure, but costs ~$73/month)
- Or use bastion only when needed (terminate after use)

---

## Prisma Studio (Local Development)

If you want a GUI for your database:

```bash
# Temporarily enable public access (DEV ONLY!)
aws rds modify-db-instance \
  --db-instance-identifier nora-db \
  --publicly-accessible \
  --region us-east-1

# Wait for modification
aws rds wait db-instance-available \
  --db-instance-identifier nora-db \
  --region us-east-1

# Update local DATABASE_URL
# Then run:
npx prisma studio

# IMPORTANT: Disable public access after!
aws rds modify-db-instance \
  --db-instance-identifier nora-db \
  --no-publicly-accessible \
  --region us-east-1
```

**Note:** This is NOT recommended for production!

---

## Database Schema

Your production database currently has **8 tables** (10 migrations applied):

1. **User** - User accounts with encrypted fields
2. **Session** - Practice sessions with PCIT coding
3. **LearningProgress** - Learning progress tracking
4. **ModuleHistory** - Module viewing history
5. **RefreshToken** - Authentication refresh tokens
6. **RiskAuditLog** - Risk detection audit logs
7. **ThirdPartyRequest** - Third-party data requests
8. **WacbSurvey** - WACB survey responses

**Migrations applied:**
- ✅ 20251120073046_init
- ✅ 20251121100710_add_learning_progress
- ✅ 20251121164347_add_child_metrics
- ✅ 20251122041323_add_user_streak_fields
- ✅ 20251124075746_add_child_age_and_condition
- ✅ 20251124102035_add_third_party_request_anonymization
- ✅ 20251125071312_convert_child_conditions_to_encrypted_string
- ✅ 20251125150548_make_child_fields_mandatory
- ✅ 20251126111947_add_email_hash_field
- ✅ 20251126123659_add_wacb_survey

---

## Quick Reference

| Method | Pros | Cons | Best For |
|--------|------|------|----------|
| Bastion + SSM | ✅ Full psql access<br>✅ No SSH keys<br>✅ Can run migrations<br>✅ Secure | ⚠️ ~$7.50/month if left running | Quick queries, migrations, data imports |
| App Runner | ✅ Already configured<br>✅ Can run migrations | ❌ No direct access | Migrations via deployment |
| Lambda | ✅ Serverless<br>✅ Automated | ❌ Complex setup | Scheduled jobs, reports |

---

## Connection String Format

**Production:**
```
postgresql://nora_admin:FPEBKqGY6LU4IXsxM4quqJMxfPccZCsn@nora-db.cst6ygywo6de.us-east-1.rds.amazonaws.com:5432/nora
```

**Development:**
```
postgresql://nora_admin:D7upDeIjZc1S1BG6Mca1QxKzVqxF4Bbw@nora-db-dev.cst6ygywo6de.us-east-1.rds.amazonaws.com:5432/nora_dev
```

**Get passwords:**
```bash
# From aws-resources.txt
grep DB_PASSWORD aws-resources.txt        # Production
grep DB_PASSWORD_DEV aws-resources.txt   # Development

# Or from Secrets Manager (production only)
aws secretsmanager get-secret-value \
  --secret-id nora/database-url \
  --region us-east-1 \
  --query SecretString \
  --output text
```
