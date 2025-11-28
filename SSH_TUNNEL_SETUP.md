# SSH Tunnel Setup for Database Access

## Why SSH Tunnel?

Your development database (`nora-db-dev`) is in a **private subnet** for security. To access it from your local machine, we use an SSH tunnel through the bastion host.

**Benefits:**
- ✅ Database stays secure (not publicly accessible)
- ✅ No need to whitelist your IP address
- ✅ Works from anywhere
- ✅ Industry best practice

---

## Step 1: Install AWS Session Manager Plugin

The Session Manager plugin is required for the SSH tunnel to work.

### macOS Installation:

```bash
brew install --cask session-manager-plugin
```

**Note:** You'll be prompted for your password (sudo required).

**Alternative manual installation:**
1. Download: https://s3.amazonaws.com/session-manager-downloads/plugin/latest/mac/session-manager-plugin.pkg
2. Double-click the `.pkg` file to install
3. Restart your terminal

### Verify Installation:

```bash
session-manager-plugin
```

You should see: `The Session Manager plugin was installed successfully. Use the AWS CLI to start a session.`

---

## Step 2: Start the SSH Tunnel

Open a **new terminal window** and run:

```bash
cd /Users/mia/happypillar
./scripts/start-db-tunnel.sh
```

**You should see:**
```
🔧 Starting SSH tunnel to development database...

This will forward:
  localhost:5432 → nora-db-dev.cst6ygywo6de.us-east-1.rds.amazonaws.com:5432

Press Ctrl+C to stop the tunnel when done.

Starting session with SessionId: ...
Port 5432 opened for sessionId ...
```

**Keep this terminal window open** while you're developing.

---

## Step 3: Start Your Application

In a **different terminal window**, start your app:

```bash
cd /Users/mia/happypillar
npm run dev:all
```

Your app will now connect to `localhost:5432`, which tunnels to the AWS database.

---

## Step 4: Test Login

Go to: http://localhost:5173

Try logging in with one of the imported test users:
- Email: `test@example.com`
- Password: (whatever was set in the Google Cloud database)

---

## Troubleshooting

### "session-manager-plugin not found"
- Install the plugin using Step 1 above
- Restart your terminal after installation

### "Port 5432 is already in use"
- Check if another PostgreSQL instance is running: `lsof -i :5432`
- Stop local PostgreSQL: `brew services stop postgresql` (if installed)
- Or kill the process: `kill -9 $(lsof -ti:5432)`

### "Could not connect to the endpoint URL"
- Make sure you have AWS credentials configured: `aws sts get-caller-identity`
- Verify bastion is running: `aws ec2 describe-instances --instance-ids i-0816636c6667be898 --region us-east-1 --query 'Reservations[0].Instances[0].State.Name'`

### "Connection refused" in your app
- Make sure the tunnel is running (Step 2)
- Check the tunnel terminal for errors
- Verify `.env` DATABASE_URL uses `localhost:5432`

---

## Daily Workflow

1. **Start tunnel** (in terminal 1): `./scripts/start-db-tunnel.sh`
2. **Start app** (in terminal 2): `npm run dev:all`
3. **Develop** normally
4. **Stop tunnel** when done: Press `Ctrl+C` in tunnel terminal

---

## Cost Savings

The bastion instance costs ~$7.50/month if left running 24/7.

**To save money, stop the bastion when not in use:**

```bash
# Stop bastion (saves money)
aws ec2 stop-instances --instance-ids i-0816636c6667be898 --region us-east-1

# Start bastion when you need it
aws ec2 start-instances --instance-ids i-0816636c6667be898 --region us-east-1
aws ec2 wait instance-running --instance-ids i-0816636c6667be898 --region us-east-1
```

**Tip:** Create an alias in your `~/.zshrc`:
```bash
alias bastion-start='aws ec2 start-instances --instance-ids i-0816636c6667be898 --region us-east-1 && aws ec2 wait instance-running --instance-ids i-0816636c6667be898 --region us-east-1 && echo "Bastion is ready!"'
alias bastion-stop='aws ec2 stop-instances --instance-ids i-0816636c6667be898 --region us-east-1 && echo "Bastion stopped"'
```

---

## Manual Tunnel Command (Alternative)

If you prefer to run the tunnel command directly without the script:

```bash
aws ssm start-session \
  --target i-0816636c6667be898 \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["nora-db-dev.cst6ygywo6de.us-east-1.rds.amazonaws.com"],"portNumber":["5432"],"localPortNumber":["5432"]}' \
  --region us-east-1
```

---

## Related Documentation

- **AWS_RESOURCES_SUMMARY.md** - Complete AWS infrastructure overview
- **DATABASE_ACCESS_GUIDE.md** - Database access methods
- **scripts/start-db-tunnel.sh** - Tunnel startup script
