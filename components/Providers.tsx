'use client';

import { BitcoinConnectConfig } from '@getalby/bitcoin-connect-react';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <BitcoinConnectConfig
            appName="Blob Simulator"
            filters={["nwc"]} // Optional: filter specific connectors if needed
        >
            {children}
        </BitcoinConnectConfig>
    );
}
