# Testing the Trading Flow

You need **two browser sessions** (e.g. Chrome + Incognito, or Chrome + Firefox) logged in as different users.

## Prerequisites

- App running locally (`npm run dev`) or deployed
- Two registered accounts (sign up at `/signup` if needed)
- Database migrations applied (001–006 at minimum)

## Step-by-step

### 1. Create a trade session (Player A)

1. Log in as **Player A**
2. Go to `/trade`
3. Click **Create Trade Session**
4. You'll be redirected to `/trade/session/<id>` showing:
   - A QR code
   - A text code (e.g. `A1B2C3D4E5F6`)
   - A 2-minute countdown timer
5. Copy the text code

### 2. Join the session (Player B)

1. In your second browser, log in as **Player B**
2. Go to `/trade`
3. Paste the code into the **QR Code** input field
4. Click **Join Trade Session**
5. You'll be redirected to the same session page
6. Both browsers should now show status: **Connected**

> Alternatively, Player B can scan the QR code with their phone camera — it opens a link like `/trade?join=A1B2C3D4E5F6` which auto-fills the code.

### 3. Build a trade proposal

Either player can propose a trade:

1. Click **Build a Trade**
2. The trade builder opens with two panes:
   - **You're giving** (left/top) — cards you're offering
   - **You're getting** (right/bottom) — cards you want from the other player
3. Type a card name in the search box (e.g. "Lightning Bolt", "Jace")
4. Click a card from the dropdown to add it
5. For each card you can adjust:
   - **Condition**: NM, LP, MP, HP (affects price via multiplier)
   - **Finish**: Normal or Foil
   - **Quantity**
6. The running totals update in real time
7. The summary bar at the bottom shows the value difference

### 4. Send the proposal

1. Optionally type a message (e.g. "How about this?")
2. Click **Send Proposal**
3. The system resolves each card to a local database record (creating one from Scryfall if it doesn't exist yet)
4. The proposal appears in the **Proposals** section for both players

### 5. Respond to the proposal (other player)

1. The other player sees the proposal with:
   - Items on each side with values
   - Fairness percentage (green = within 5%, yellow = within 10%, red = beyond 10%)
2. They can:
   - **Accept** — completes the trade
   - **Reject** — optionally with a reason
3. After accepting, the session status changes to **Completed**

### 6. Iterate

If rejected, either player can build and send a new proposal. The proposal history stays visible on the session page.

## Pricing notes

- Card prices come from **Scryfall's USD prices** shown in the search dropdown
- Condition multipliers: NM = 100%, LP = 90%, MP = 75%, HP = 50%
- Finish multipliers: Normal = 100%, Foil = 150%
- The fairness percentage compares the total value of each side

## Known limitations for demo

- Proposals use mock storage (not persisted to DB unless migration 006 is fully wired)
- No camera-based QR scanning yet — manual code entry only
- No inventory validation (doesn't check if you actually own the cards)
- Session QR codes expire after 2 minutes — create a new session if it expires before joining
- Polling-based updates (5-second interval), not real-time WebSocket
