# Pulse - Live Event Sentiment & Micro-Tipping

A real-time web app for the Alien.org hackathon. Pulse allows attendees to share sentiment and send micro-tips during live events, all running inside the Alien app's WebView.

## Features

- **Real-time sentiment tracking** with live visualizations
- **Micro-tipping** integration with Alien Wallet
- **Mobile-first attendee view** optimized for phones
- **Impressive host dashboard** for projectors
- **Sybil protection** via Alien identity (one human = one voice)
- **No database required** - everything runs in memory
- **Auto-reconnecting WebSocket** connections

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start the server**
   ```bash
   npm start
   ```

3. **Open your browser**
   - Landing page: http://localhost:3000
   - Create a room as host or join with a room code

## Project Structure

```
pulse/
├── server.js              # Express + WebSocket server
├── package.json           # Dependencies and scripts
├── .env.example           # Environment variables template
├── render.yaml            # Render deployment config
├── alien-mock.js          # Mock Alien SDK for local dev
├── public/
│   ├── index.html         # Landing: create or join a room
│   ├── attend.html        # Attendee view: sentiment slider + tip buttons
│   ├── host.html          # Host dashboard: heatmap, tip feed, QR code
│   ├── css/
│   │   └── style.css      # Dark theme, mobile-first
│   └── js/
│       ├── attend.js      # Attendee WebSocket logic
│       ├── host.js        # Host dashboard WebSocket logic + charts
│       └── shared.js      # Common utilities and Alien bridge wrapper
```

## API Endpoints

### REST
- `POST /api/rooms` - Create a room
  ```json
  { "title": "Keynote Talk", "hostId": "user_xyz", "speakerWallet": "wallet_xyz" }
  ```
- `GET /api/rooms/:roomId` - Get room info

### WebSocket Messages

**Client → Server:**
```json
{ "type": "join", "roomId": "ABC123", "alienId": "user_xyz", "role": "attendee" }
{ "type": "sentiment", "value": 0.73 }
{ "type": "tip", "amount": 1.00, "txId": "tx_abc" }
{ "type": "leave" }
```

**Server → Client:**
```json
{ "type": "snapshot", "avg": 0.72, "count": 45, "ts": 1707400000 }
{ "type": "tip_event", "amount": 1.00, "totalTips": 15.50, "ts": 1707400000 }
{ "type": "user_count", "count": 47 }
{ "type": "room_info", "title": "Keynote Talk", "speakerWallet": "wallet_xyz" }
```

## Alien Integration

The app integrates with the Alien platform via two JS Bridge APIs:

1. **`alien.getIdentity()`** - Returns verified human ID
2. **`alien.requestPayment({ to, amount })`** - Triggers Alien Wallet payment

For local development, a mock implementation is provided in `alien-mock.js`.

## Deployment

### Render (Recommended)
1. Push to GitHub
2. Connect repository to Render
3. Render will automatically detect `render.yaml` and deploy

### Manual Deployment
```bash
npm install --production
npm start
```

The server listens on `process.env.PORT || 3000` and binds to `0.0.0.0`.

## Technology Stack

- **Backend:** Node.js, Express, WebSocket (ws library)
- **Frontend:** Vanilla HTML/CSS/JavaScript (no build tools)
- **Charts:** Chart.js (CDN)
- **QR Codes:** QRCode.js (CDN)
- **Styling:** Custom CSS with CSS variables, Inter font

## Design System

- **Colors:** Dark theme with electric blue accent
- **Typography:** Inter font family
- **Mobile-first:** Optimized for touch interfaces
- **Accessibility:** ARIA labels and semantic HTML

## Development Notes

- No database required - everything in memory
- No build tools - plain HTML/CSS/JS
- WebSocket auto-reconnection with exponential backoff
- Sentiment updates throttled to 1 message per 500ms
- Room IDs are 6-character alphanumeric codes

## License

MIT
