import { NextRequest, NextResponse } from 'next/server';
import { NWCClient } from "@getalby/sdk";

export const runtime = 'edge';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const hash = searchParams.get('hash');
        const isMock = searchParams.get('mock') === 'true';

        if (!hash) {
            return NextResponse.json({ error: 'Missing hash' }, { status: 400 });
        }

        if (isMock || hash.startsWith('mock_')) {
            // Mock success for testing without paying
            return NextResponse.json({ settled: true });
        }

        const connectionString = process.env.NWC_CONNECTION_STRING;
        if (!connectionString) {
            return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
        }

        const client = new NWCClient({ nostrWalletConnectUrl: connectionString });
        const result = await client.lookupInvoice({ payment_hash: hash });

        return NextResponse.json({ settled: !!result?.settled_at });

    } catch (error: any) {
        console.error('Verify Error:', error);
        return NextResponse.json({ settled: false });
    }
}
