export { };

declare global {
    interface Window {
        webln?: {
            enable: () => Promise<void>;
            sendPayment: (invoice: string) => Promise<{ preimage: string }>;
        };
    }
}
