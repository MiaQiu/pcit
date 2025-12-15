# Lesson Sharing Feature

## Overview

The lesson sharing feature allows users to generate shareable web links for lessons. When someone clicks on a shared link, they'll see a beautifully formatted web page displaying the lesson content.

## How It Works

1. **User clicks share button** in the lesson viewer
2. **Mobile app generates a web link** with the lesson ID: `https://your-domain.com/share-lesson.html?lesson_id=12345`
3. **Link can be copied and shared** via any messaging app, email, or social media
4. **Recipients click the link** and see a template page that displays the lesson content
5. **Template page fetches lesson data** from the public API endpoint
6. **Lesson content is displayed** in a responsive, mobile-friendly format

## Architecture

### 1. Static HTML Template
- **Location:** `/public/share-lesson.html`
- **Purpose:** Single-page template that displays any lesson
- **Features:**
  - Responsive design (mobile & desktop)
  - Beautiful gradient styling
  - Support for markdown formatting (bold, bullets)
  - Call-to-action to download the app
  - Open Graph meta tags for rich link previews

### 2. Public API Endpoint
- **Route:** `GET /api/lessons/share/:id`
- **Auth:** None required (public endpoint)
- **Returns:** Lesson content only (no quiz, no user progress)
- **Located in:** `/server/routes/lessons.cjs`

### 3. Mobile Share Function
- **Location:** `/nora-mobile/src/screens/LessonViewerScreen.tsx`
- **Function:** `handleShare()`
- **Uses:** React Native's Share API
- **Generates:** Web link with lesson ID parameter

## Configuration

### Development Setup

1. **Add environment variable** to your `.env` file:
   ```bash
   EXPO_PUBLIC_WEB_URL=http://localhost:3001
   ```

2. **Start the backend server** (serves the static HTML):
   ```bash
   npm run server
   ```

3. **Start the mobile app**:
   ```bash
   npm run dev:mobile
   ```

4. **Test sharing**:
   - Open a lesson in the mobile app
   - Click the share button
   - The generated link should be: `http://localhost:3001/share-lesson.html?lesson_id=<id>`

### Production Deployment

1. **Deploy the backend** to your hosting service (e.g., AWS App Runner, Heroku, Render)

2. **Update environment variables**:
   - In your hosting service, set `NODE_ENV=production`
   - In mobile app, set `EXPO_PUBLIC_WEB_URL=https://your-domain.com`

3. **Update API URL in HTML** (optional for advanced setups):
   - Edit `/public/share-lesson.html`
   - Update the `API_URL` constant to your production API URL

4. **Test the flow**:
   - Share a lesson from the mobile app
   - Open the link on a different device
   - Verify the lesson displays correctly

## Customization

### Styling
Edit `/public/share-lesson.html` to customize:
- Colors and gradients
- Fonts
- Layout
- Call-to-action text and links

### Metadata for Link Previews
Update the Open Graph meta tags in the HTML `<head>`:
```html
<meta property="og:title" content="Your Custom Title" />
<meta property="og:description" content="Your description" />
<meta property="og:image" content="https://your-domain.com/preview-image.jpg" />
```

### Call-to-Action
Update the CTA button href to link to:
- App Store / Google Play download pages
- Your website
- A landing page

## Security Notes

- The share endpoint is **public** (no authentication required)
- Only lesson content is exposed (no user data, no quiz answers)
- Consider rate limiting if needed for production

## Future Enhancements

- [ ] Add dynamic Open Graph images (lesson-specific preview images)
- [ ] Track share analytics (how many times a lesson is viewed via share link)
- [ ] Add social sharing buttons (Facebook, Twitter, WhatsApp)
- [ ] Support deep linking (open lesson in app if installed)
- [ ] Cache lesson data in the HTML template for faster loading
