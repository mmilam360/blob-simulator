import { NextRequest, NextResponse } from 'next/server';
import { NWCHelper } from '@/lib/nwc';

export const runtime = 'edge';

async function resolveLightningAddress(address: string, amountSats: number) {
    // 1. Get LNURL Parts
    const parts = address.split('@');
    if (parts.length !== 2) throw new Error('Invalid Lightning Address');
    const [user, domain] = parts;

    // 2. Fetch Metadata
    const lnurlRes = await fetch(`https://${domain}/.well-known/lnurlp/${user}`);
    const lnurlData = await lnurlRes.json();

    if (lnurlData.status === 'ERROR') throw new Error(lnurlData.reason);
    if (!lnurlData.callback) throw new Error('No callback found');

    // 3. Get Invoice
    const amountMillisats = amountSats * 1000;
    // Verify min/max
    if (amountMillisats < lnurlData.minSendable || amountMillisats > lnurlData.maxSendable) {
        throw new Error(`Amount out of range for this address.`);
    }

    const cbRes = await fetch(`${lnurlData.callback}?amount=${amountMillisats}`);
    const cbData = await cbRes.json();

    if (cbData.status === 'ERROR') throw new Error(cbData.reason);

    return cbData.pr;
}

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

        // 1. Resolve Invoice
        const invoice = await resolveLightningAddress(address, amount);

        // 2. Pay via NWC
        const nwc = new NWCHelper(connectionString);
        const preimage = await nwc.payInvoice(invoice);

        return NextResponse.json({ success: true, preimage });

    } catch (error: any) {
        console.error('Payout Error:', error);
        return NextResponse.json({ error: error.message || 'Payout failed' }, { status: 500 });
    }
}
