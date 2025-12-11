# Quick Build Reference

## 🏃‍♂️ For Development (Expo Go)

```bash
# Terminal 1: Start backend
cd /Users/mia/nora
node server.cjs

# Terminal 2: Start database tunnel
cd /Users/mia/nora
./scripts/start-db-tunnel.sh

# Terminal 3: Start Expo
cd /Users/mia/nora/nora-mobile
npm start
```

**Environment:** Uses `.env` with local IP

---

## 🚀 For TestFlight (Xcode)

```bash
# 1. Switch to production
cd /Users/mia/nora/nora-mobile
cp .env.production .env

# 2. Open Xcode
open ios/Nora.xcodeproj

# 3. In Xcode:
#    - Edit Scheme → Set Build Configuration to "Release"
#    - Select "Any iOS Device (arm64)"
#    - Product → Archive
#    - Distribute to TestFlight

# 4. After upload, restore dev environment
git checkout .env
```

**Environment:** Uses `.env.production` with AWS backend

**No local server needed!** ✨

---

## 🔍 Verify Current Environment

```bash
cd /Users/mia/nora/nora-mobile
grep EXPO_PUBLIC_API_URL .env
```

**Should show:**
- Development: `http://172.20.10.9:3001`
- Production: `https://p2tgddmyxt.us-east-1.awsapprunner.com`

---

## ✅ TestFlight Checklist

- [ ] `cp .env.production .env`
- [ ] Verify: `grep EXPO_PUBLIC_API_URL .env`
- [ ] Open Xcode
- [ ] Set Release configuration
- [ ] Archive and upload
- [ ] `git checkout .env` (restore dev settings)

---

## 💡 Key Points

1. **server.cjs** = Only for Expo Go development
2. **start-db-tunnel.sh** = Only for Expo Go development
3. **TestFlight builds** = Connect directly to AWS (no local setup needed)
4. **Always restore** `.env` after TestFlight builds

---

See `TESTFLIGHT_BUILD_GUIDE.md` for detailed instructions.
