# SatsBlob - Lightning Network Blob Simulator

A physics-based "battle royale" where blobs absorb each other.
**Features:**
- **Bitcoin Buy-In**: Pay Satoshis via Lightning (NWC) to spawn a blob. Size = Payment Amount.
- **Physics Engine**: Custom 2D collision and absorption logic.
- **Payouts**: The last blob standing automatically receives 95% of the pot (via NWC).
- **Tech Stack**: Next.js (App Router), TailwindCSS, Cloudflare Pages.

## Simulation Mode
If no `NWC_CONNECTION_STRING` is provided, the app runs in **Demo Mode**:
- Invoices are mocked.
- Payments are simulated after a short delay.
- No real funds are moved.

## Deployment Guide (Cloudflare Pages)

1.  **Framework Preset**: Next.js
2.  **Build Command**: `npx @cloudflare/next-on-pages`
3.  **Build Output**: `.vercel/output/static`
4.  **Environment Variables**:
    - `NWC_CONNECTION_STRING`: Your NWC Secret URL (starts with `nostr+walletconnect://...`).
      - Permissions required: `make_invoice`, `lookup_invoice`, `pay_invoice` (optional, for payouts).

## Local Development

1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Run development server:
    ```bash
    npm run dev
    ```
3.  (Optional) Add `.env.local` with your NWC string to test real payments locally.
