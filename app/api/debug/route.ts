import { NextRequest, NextResponse } from 'next/server';
import { getPublicKey, generateSecretKey } from 'nostr-tools';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
    try {
        const env_check = {
            hasBuffer: typeof Buffer !== 'undefined',
            hasCrypto: typeof crypto !== 'undefined',
            hasWebSocket: typeof WebSocket !== 'undefined',
            hasTextEncoder: typeof TextEncoder !== 'undefined',
        };

        // Test nostr-tools basic
        const sk = generateSecretKey();
        const pk = getPublicKey(sk);

        return NextResponse.json({
            status: 'ok',
            env: env_check,
            nostr_test: { pk }
        });
    } catch (e: any) {
        return NextResponse.json({
            status: 'error',
            message: e.message,
            stack: e.stack
        }, { status: 500 });
    }
}
