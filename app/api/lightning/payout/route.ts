import { NextRequest, NextResponse } from 'next/server';
import { LN } from "@getalby/sdk";

export const runtime = 'edge';

export async function POST(req: NextRequest) {
    try {
        const { address, amount } = await req.json();

        if (!address || !amount) {
            return NextResponse.json({ error: 'Missing address or amount' }, { status: 400 });
        }

        const connectionString = process.env.NWC_CONNECTION_STRING;
        if (!connectionString) {
            // Mock success
            console.log(`[MOCK] Would pay ${amount} sats to ${address}`);
            return NextResponse.json({ success: true, mock: true });
        }

        const ln = new LN(connectionString);
        // SDK handles Lightning Address resolution automatically!
        await ln.pay(address, { satoshi: Number(amount) });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Payout Error:', error);
        return NextResponse.json({ error: error.message || 'Payout failed' }, { status: 500 });
    }
}
