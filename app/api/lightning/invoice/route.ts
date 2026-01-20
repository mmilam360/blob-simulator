import { SimpleNWC } from '@/lib/simple-nwc';

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

        const nwc = new SimpleNWC(connectionString);
        const { invoice, paymentHash } = await nwc.createInvoice(Number(amount));

        return NextResponse.json({ payment_request: invoice, payment_hash: paymentHash });

    } catch (error: any) {
        console.error('Invoice Creation Error Full:', error);
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        return NextResponse.json({
            error: errorMessage || 'Failed to create invoice',
            details: error.toString()
        }, { status: 500 });
    }
}
