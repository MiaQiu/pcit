require('dotenv').config();
const { Client } = require('pg');
const crypto = require('crypto');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

function decrypt(text) {
  if (!text) return null;
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let d = decipher.update(encrypted, 'hex', 'utf8');
    d += decipher.final('utf8');
    return d;
  } catch(e) { return text; }
}

const client = new Client({
  connectionString: 'postgresql://nora_admin:SvnD5rjj9MSlb0xGeCstfzn5e7ZcSdkR@localhost:5433/nora',
  ssl: { rejectUnauthorized: false }
});

client.connect().then(async () => {
  const res = await client.query('SELECT id, email, name FROM "User" ORDER BY "createdAt" DESC');
  console.log('ID | Name | Email');
  console.log('-'.repeat(100));
  res.rows.forEach(u => {
    console.log(`${u.id} | ${decrypt(u.name)} | ${decrypt(u.email)}`);
  });
  await client.end();
}).catch(e => console.error('Error:', e.message));
