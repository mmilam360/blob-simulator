import { NextRequest, NextResponse } from 'next/server';
import { NWCHelper } from '@/lib/nwc';

export const runtime = 'edge'; // Optional: Use edge if compatible, but 'nodejs' is safer for some libs. Nostr-tools works in edge usually. 
// Actually Nostr-tools uses WebSocket. Edge runtime supports standard WebSocket.
// Let's stick to default (Node) if unsure, but 'edge' is faster on Cloudflare.
// Node runtime is better for compatibility if we run into "crypto" issues.

export async function POST(req: NextRequest) {
    try {
        const { amount } = await req.json();

        if (!amount || amount < 1) {
            return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
        }

        const connectionString = process.env.NWC_CONNECTION_STRING;
        if (!connectionString) {
            // Fallback for demo if no env var
            console.warn("No NWC_CONNECTION_STRING found. Returning mock invoice.");
            return NextResponse.json({
                payment_request: "lnbc1mock...",
                payment_hash: "mock_hash_" + Date.now(),
                mock: true
            });
        }

        const nwc = new NWCHelper(connectionString);
        const { invoice, paymentHash } = await nwc.createInvoice(Number(amount));

        return NextResponse.json({ payment_request: invoice, payment_hash: paymentHash });

    } catch (error: any) {
        console.error('Invoice Creation Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to create invoice' }, { status: 500 });
    }
}
