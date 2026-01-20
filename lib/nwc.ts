import { finalizeEvent, getPublicKey, nip04, Relay, Event, nip19 } from 'nostr-tools';
import 'websocket-polyfill';

// NIP-47 Info
const NWC_KIND = 23194;

export interface NWCConnection {
    pubkey: string;
    relay: string;
    secret: string; // Wallet Service Secret (from connection string)
    lud16?: string;
}

export class NWCHelper {
    connection: NWCConnection;
    private secretKey: Uint8Array;
    private pubKey: string;

    constructor(connectionString: string) {
        this.connection = this.parseConnectionString(connectionString);
        if (!this.connection.secret) {
            throw new Error("Invalid NWC Connection string: missing secret");
        }
        this.secretKey = Buffer.from(this.connection.secret, 'hex');
        this.pubKey = getPublicKey(this.secretKey);
    }

    private parseConnectionString(uri: string): NWCConnection {
        const url = new URL(uri);
        if (url.protocol !== 'nostr+walletconnect:') {
            throw new Error('Invalid protocol');
        }

        const pubkey = url.hostname || url.pathname.replace('//', '');
        const relay = url.searchParams.get('relay');
        const secret = url.searchParams.get('secret');
        const lud16 = url.searchParams.get('lud16') || undefined;

        if (!pubkey || !relay || !secret) {
            throw new Error('Missing required NWC parameters (pubkey, relay, secret)');
        }

        return { pubkey, relay, secret, lud16 };
    }

    async createInvoice(amountSats: number, description: string = "Blob Spawn"): Promise<{ invoice: string, paymentHash: string }> {
        return this.executeNWCCommand("make_invoice", {
            amount: amountSats * 1000, // msats
            description,
            expiry: 600
        }).then(res => ({
            invoice: res.invoice,
            paymentHash: res.payment_hash
        }));
    }

    async lookupInvoice(paymentHash: string): Promise<boolean> {
        const res = await this.executeNWCCommand("lookup_invoice", { payment_hash: paymentHash });
        // partial error handling inside execute
        return res && !!res.settled_at;
    }

    async payInvoice(invoice: string): Promise<string> {
        const res = await this.executeNWCCommand("pay_invoice", { invoice });
        return res.preimage;
    }

    private async executeNWCCommand(method: string, params: any): Promise<any> {
        const relay = await Relay.connect(this.connection.relay);
        try {
            const payload = { method, params };
            const event = await this.encryptAndSign(payload);

            const responsePromise = new Promise<any>((resolve, reject) => {
                const sub = relay.subscribe([
                    {
                        kinds: [NWC_KIND],
                        authors: [this.connection.pubkey],
                        '#p': [this.pubKey],
                        '#e': [event.id]
                    }
                ], {
                    onevent: async (e) => {
                        try {
                            const decrypted = await nip04.decrypt(this.connection.secret, this.connection.pubkey, e.content);
                            const response = JSON.parse(decrypted);
                            if (response.error) {
                                // Non-fatal for lookup, fatal for pay/make
                                if (method === 'lookup_invoice') {
                                    resolve(null);
                                } else {
                                    reject(new Error(response.error.message));
                                }
                            } else {
                                resolve(response.result);
                            }
                        } catch (err) {
                            reject(err);
                        }
                        sub.close();
                    }
                });
                setTimeout(() => { sub.close(); reject(new Error("NWC Timeout")); }, 10000);
            });

            await relay.publish(event);
            return await responsePromise;
        } finally {
            relay.close();
        }
    }

    private async encryptAndSign(payload: any): Promise<Event> {
        const content = JSON.stringify(payload);
        const encryptedContent = await nip04.encrypt(this.connection.secret, this.connection.pubkey, content);
        const eventTemplate = {
            kind: NWC_KIND,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['p', this.connection.pubkey]],
            content: encryptedContent,
        };
        return finalizeEvent(eventTemplate, this.secretKey);
    }
}
