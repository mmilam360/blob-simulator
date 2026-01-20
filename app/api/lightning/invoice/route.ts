import { NextRequest, NextResponse } from 'next/server';
import { LN } from "@getalby/sdk";

export const runtime = 'edge';

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

        const ln = new LN(connectionString);
        const request = await ln.receive({ satoshi: Number(amount) });

        return NextResponse.json({
            payment_request: request.invoice,
            payment_hash: request.paymentHash
        });

    } catch (error: any) {
        console.error('Invoice Creation Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to create invoice',
            details: error.toString()
        }, { status: 500 });
    }
}
