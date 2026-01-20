import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { cbc } from '@noble/ciphers/aes.js';

// Simple Polyfill for base64 if needed, but standard btoa/atob work in Edge
function encodeBase64(bytes: Uint8Array): string {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function decodeBase64(str: string): Uint8Array {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(str, 'base64'));
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

const NWC_KIND = 23194;

export interface NWCConnection {
    pubkey: string;
    relay: string;
    secret: string;
}

export class SimpleNWC {
    connection: NWCConnection;
    private secretKey: Uint8Array;
    private pubKey: string;

    constructor(connectionString: string) {
        this.connection = this.parseConnectionString(connectionString);
        this.secretKey = hexToBytes(this.connection.secret);
        this.pubKey = bytesToHex(secp256k1.getPublicKey(this.secretKey, true)).substring(2); // Remove '02' prefix for Schnorr/Nostr? 
        // Wait, nostr pubkeys are x-only 32 bytes hex. 
        // getPublicKey(sk, true) returns 33 bytes compressed (02/03 + x).
        // For event.pubkey (Schnorr), requires 32-byte X-only.
        // For NIP-04 source param (p tag), it uses 32-byte hex.
    }

    // Helper to get 32-byte hex pubkey
    private getHexPubKey(): string {
        return bytesToHex(secp256k1.getPublicKey(this.secretKey, true).slice(1));
    }

    private parseConnectionString(uri: string): NWCConnection {
        const url = new URL(uri);
        if (url.protocol !== 'nostr+walletconnect:') {
            throw new Error('Invalid protocol');
        }
        const pubkey = url.hostname || url.pathname.replace('//', '');
        const relay = url.searchParams.get('relay');
        const secret = url.searchParams.get('secret');

        if (!pubkey || !relay || !secret) {
            throw new Error('Missing required NWC parameters');
        }
        return { pubkey, relay, secret };
    }

    async createInvoice(amountSats: number, description: string = "Blob Spawn"): Promise<{ invoice: string, paymentHash: string }> {
        const result = await this.execute("make_invoice", {
            amount: amountSats * 1000,
            description,
            expiry: 600
        });
        return {
            invoice: result.invoice,
            paymentHash: result.payment_hash
        };
    }

    async lookupInvoice(paymentHash: string): Promise<boolean> {
        try {
            const result = await this.execute("lookup_invoice", { payment_hash: paymentHash });
            return !!result.settled_at;
        } catch (e) {
            return false;
        }
    }

    async payInvoice(invoice: string): Promise<string> {
        const result = await this.execute("pay_invoice", { invoice });
        return result.preimage;
    }

    private async execute(method: string, params: any): Promise<any> {
        const relayUrl = this.connection.relay.replace('ws://', 'wss://'); // Force secure for Edge usually

        return new Promise(async (resolve, reject) => {
            const socket = new WebSocket(relayUrl);

            // Timeout
            const timeout = setTimeout(() => {
                socket.close();
                reject(new Error("NWC Timeout"));
            }, 10000);

            // Prepare Event
            const payload = JSON.stringify({ method, params });
            const { content, iv } = await this.encryptState(payload);

            const event = {
                kind: NWC_KIND,
                created_at: Math.floor(Date.now() / 1000),
                tags: [['p', this.connection.pubkey]],
                content: content + '?iv=' + iv,
                pubkey: this.getHexPubKey(),
                id: ''
            };

            event.id = this.getEventHash(event);
            const signature = await this.signEvent(event.id);

            const signedEvent = ["EVENT", { ...event, sig: signature }];

            socket.onopen = () => {
                // 1. Subscribe to response
                const subId = 'nwc-' + Math.random().toString(36).substr(2, 9);
                socket.send(JSON.stringify([
                    "REQ",
                    subId,
                    {
                        kinds: [NWC_KIND],
                        authors: [this.connection.pubkey],
                        '#e': [event.id]
                    }
                ]));

                // 2. Publish request
                socket.send(JSON.stringify(signedEvent));
            };

            socket.onmessage = async (msg) => {
                const data = JSON.parse(msg.data.toString());
                if (data[0] === 'EVENT') {
                    const responseEvent = data[2];
                    if (responseEvent.tags.find((t: string[]) => t[0] === 'e' && t[1] === event.id)) {
                        try {
                            const decrypted = await this.decryptState(responseEvent.content);
                            const result = JSON.parse(decrypted);
                            if (result.error) {
                                if (method !== 'lookup_invoice') { // dont throw on lookup
                                    clearTimeout(timeout);
                                    socket.close();
                                    reject(new Error(result.error.message));
                                    return;
                                }
                            }
                            clearTimeout(timeout);
                            socket.close();
                            resolve(result.result);
                        } catch (e) {
                            // Decryption failed or bad format
                        }
                    }
                }
                if (data[0] === 'EOSE') {
                    // End of stored events
                }
                if (data[0] === 'klosed') { // Notice
                    console.log("Relay closed:", data);
                }
            };

            socket.onerror = (e) => {
                console.error("WebSocket Error", e);
            };
        });
    }

    // --- Crypto Helpers ---

    private getEventHash(event: any): string {
        const serialized = JSON.stringify([
            0,
            event.pubkey,
            event.created_at,
            event.kind,
            event.tags,
            event.content
        ]);
        const hash = sha256(new TextEncoder().encode(serialized));
        return bytesToHex(hash);
    }

    private async signEvent(eventId: string): Promise<string> {
        const sig = secp256k1.sign(hexToBytes(eventId), this.secretKey);
        return bytesToHex(sig.toCompactRawBytes());
    }

    private async encryptState(text: string): Promise<{ content: string, iv: string }> {
        // Shared Secret: X coordinate of (myPriv * remotePub)
        const remotePubBytes = hexToBytes('02' + this.connection.pubkey); // Add 02 prefix to make it compressed point
        const sharedPoint = secp256k1.getSharedSecret(this.secretKey, remotePubBytes, true);
        const sharedX = sharedPoint.slice(1); // Drop 02/03 prefix

        const iv = crypto.getRandomValues(new Uint8Array(16));
        const textBytes = new TextEncoder().encode(text);
        const cipher = cbc(sharedX, iv);
        const encrypted = cipher.encrypt(textBytes);

        return {
            content: encodeBase64(encrypted),
            iv: encodeBase64(iv)
        };
    }

    private async decryptState(contentWithIv: string): Promise<string> {
        const [contentBase64, ivParam] = contentWithIv.split('?iv=');
        if (!ivParam) throw new Error("Missing IV");

        const iv = decodeBase64(ivParam);
        const ciphertext = decodeBase64(contentBase64);

        const remotePubBytes = hexToBytes('02' + this.connection.pubkey);
        const sharedPoint = secp256k1.getSharedSecret(this.secretKey, remotePubBytes, true);
        const sharedX = sharedPoint.slice(1);

        const cipher = cbc(sharedX, iv);
        const decryptedBytes = cipher.decrypt(ciphertext);

        return new TextDecoder().decode(decryptedBytes);
    }
}
