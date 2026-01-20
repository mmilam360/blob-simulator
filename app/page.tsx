import dynamic from 'next/dynamic';

const BitcoinConnectButton = dynamic(
    () => import("@getalby/bitcoin-connect-react").then((mod) => mod.Button),
    { ssr: false }
);

export default function Home() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [gameMethods, setGameMethods] = useState<any>(null);
    const [isBuyInOpen, setIsBuyInOpen] = useState(false);

    // Game State
    const [pot, setPot] = useState(0);
    const [lastWinner, setLastWinner] = useState<{ name: string, amount: number } | null>(null);

    // Payment State
    const [paymentAmount, setPaymentAmount] = useState(100);
    const [playerName, setPlayerName] = useState('');
    const [payoutAddress, setPayoutAddress] = useState('');
    const [processing, setProcessing] = useState(false);

    // Invoice State
    const [invoice, setInvoice] = useState<string>('');
    const [paymentHash, setPaymentHash] = useState<string>('');

    const handleGameInit = (methods: any) => {
        setGameMethods(methods);
    };

    const handleStart = () => {
        setIsPlaying(true);
        setLastWinner(null);
    };

    const handleReset = () => {
        setIsPlaying(false);
        gameMethods?.resetGame();
        setPot(0);
        setLastWinner(null);
    };

    const handleWinner = async (blob: any) => {
        setIsPlaying(false);
        const winAmount = Math.floor(pot * 0.95);
        setLastWinner({ name: blob.name, amount: winAmount });

        if (blob.payoutAddress && winAmount > 0) {
            try {
                console.log(`Paying ${winAmount} sats to ${blob.payoutAddress}...`);
                await fetch('/api/lightning/payout', {
                    method: 'POST',
                    body: JSON.stringify({ address: blob.payoutAddress, amount: winAmount })
                });
            } catch (e) {
                console.error("Payout failed", e);
            }
        }
    };

    const handleBuyIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!payoutAddress.includes('@') && payoutAddress.length > 0) {
            alert("Please enter a valid Lightning Address (e.g. user@domain.com)");
            return;
        }

        setProcessing(true);
        setInvoice('');

        try {
            // 1. Get Invoice
            const res = await fetch('/api/lightning/invoice', {
                method: 'POST',
                body: JSON.stringify({ amount: paymentAmount }),
            });
            const data = await res.json();

            if (data.error) throw new Error(data.error + (data.details ? ` (${data.details})` : ''));

            setInvoice(data.payment_request);
            setPaymentHash(data.payment_hash);

            // 1b. Attempt Auto-Pay with Bitcoin Connect
            try {
                if (window.webln) {
                    await window.webln.enable();
                    await window.webln.sendPayment(data.payment_request);
                }
                // If successful, the poller below will catch it instantly
            } catch (bcError) {
                console.log("Bitcoin Connect auto-pay skipped or failed", bcError);
                // Continue to manual flow
            }

            // 2. Start Polling for Payment
            const pollInterval = setInterval(async () => {
                try {
                    const verifyRes = await fetch(`/api/lightning/verify?hash=${data.payment_hash}&mock=${data.mock}`);
                    const verifyData = await verifyRes.json();

                    if (verifyData.settled) {
                        clearInterval(pollInterval);
                        // Success!
                        gameMethods?.addBlob(paymentAmount, playerName || 'Anon', payoutAddress);
                        setPot(p => p + paymentAmount);

                        setIsBuyInOpen(false);
                        setPlayerName('');
                        setInvoice('');
                        setPaymentHash('');
                        setProcessing(false);
                    }
                } catch (err) {
                    console.error("Polling error", err);
                }
            }, 2000);

            // Timeout after 2 mins
            setTimeout(() => clearInterval(pollInterval), 120000);

        } catch (err: any) {
            console.error(err);
            setProcessing(false);
            alert("Failed to generate invoice: " + err.message);
        }
    };

    return (
        <main className="min-h-screen bg-black text-white font-sans selection:bg-yellow-500/30">

            {/* Header */}
            <header className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-tr from-yellow-400 to-orange-600 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20">
                        <Zap className="text-white fill-current" size={20} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                            SatsBlob
                        </h1>
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest">NWC Powered</div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <BitcoinConnectButton />
                    <div className="px-5 py-2 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-sm font-bold shadow-[0_0_15px_rgba(234,179,8,0.1)]">
                        POT: {pot.toLocaleString()} Sats
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="container mx-auto p-4 lg:p-8 grid lg:grid-cols-[1fr_350px] gap-8 h-[calc(100vh-80px)]">

                {/* Game Area */}
                <div className="flex flex-col gap-4 h-full relative">
                    <GameCanvas active={isPlaying} onGameInit={handleGameInit} onWinner={handleWinner} />

                    {lastWinner && (
                        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                            <div className="bg-black/80 backdrop-blur-md border border-yellow-500/50 p-8 rounded-2xl text-center shadow-2xl animate-in zoom-in duration-300">
                                <Trophy className="mx-auto text-yellow-400 mb-4" size={48} />
                                <h2 className="text-3xl font-bold text-white mb-2">{lastWinner.name} Wins!</h2>
                                <p className="text-yellow-400 text-xl font-mono">+{lastWinner.amount} sats</p>
                                <p className="text-gray-500 text-xs mt-2">Payout Sent via Lightning</p>
                            </div>
                        </div>
                    )}

                    {/* Controls */}
                    <div className="flex justify-between items-center p-4 bg-gray-900/50 rounded-xl border border-gray-800">
                        <div className="flex gap-2">
                            {!isPlaying ? (
                                <button
                                    onClick={handleStart}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-all shadow-lg hover:shadow-xl active:scale-95"
                                >
                                    <Play size={18} fill="currentColor" /> Start Round
                                </button>
                            ) : (
                                <button
                                    onClick={() => setIsPlaying(false)}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 transition-all border border-gray-700"
                                >
                                    Pause
                                </button>
                            )}

                            <button
                                onClick={handleReset}
                                className="p-3 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                title="Reset Board"
                            >
                                <RotateCcw size={20} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sidebar / Interaction */}
                <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6 flex flex-col gap-6 h-fit sticky top-24">
                    <div>
                        <h2 className="text-xl font-bold mb-2">Join the Arena</h2>
                        <p className="text-gray-400 text-sm">Pay sats to spawn a blob. Bigger pay = Bigger blob. Last survivor takes 95% of pot!</p>
                    </div>

                    <button
                        onClick={() => setIsBuyInOpen(!isBuyInOpen)}
                        className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-xl font-bold text-lg shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        <PlusCircle size={24} /> Buy In Now
                    </button>

                    {isBuyInOpen && (
                        <form onSubmit={handleBuyIn} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 border-l-4 border-l-yellow-500 animate-in slide-in-from-top-2 fade-in duration-200">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Display Name</label>
                                    <input
                                        type="text"
                                        value={playerName}
                                        onChange={(e) => setPlayerName(e.target.value)}
                                        placeholder="Enter name..."
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                                        maxLength={12}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Lightning Address (for Payouts)</label>
                                    <input
                                        type="email"
                                        value={payoutAddress}
                                        onChange={(e) => setPayoutAddress(e.target.value)}
                                        placeholder="e.g. user@getalby.com"
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Buy In Amount (Sats)</label>
                                    <div className="grid grid-cols-3 gap-2 mb-2">
                                        {[100, 1000, 5000].map(amt => (
                                            <button
                                                type="button"
                                                key={amt}
                                                onClick={() => setPaymentAmount(amt)}
                                                className={`py-1.5 rounded-md text-sm font-medium transition-colors ${paymentAmount === amt ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' : 'bg-gray-900 border border-gray-700 hover:bg-gray-700'}`}
                                            >
                                                {amt}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">⚡</span>
                                        <input
                                            type="number"
                                            value={paymentAmount}
                                            onChange={(e) => setPaymentAmount(Number(e.target.value))}
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                                            min={1}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={processing && !invoice}
                                    className="w-full py-2 bg-white text-black font-bold rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                                >
                                    {processing && !invoice ? (
                                        <>Generating Invoice...</>
                                    ) : invoice ? (
                                        <>Waiting for Payment...</>
                                    ) : (
                                        <>Pay {paymentAmount} Sats & Spawn</>
                                    )}
                                </button>

                                {invoice && (
                                    <div className="mt-4 p-4 bg-white rounded-lg">
                                        <div className="text-black text-[10px] break-all font-mono mb-2 max-h-20 overflow-y-auto">
                                            {invoice}
                                        </div>
                                        <div className="text-center text-xs text-black font-medium">
                                            {processing ? 'Processing...' : 'Scan with Lightning Wallet'}
                                        </div>
                                    </div>
                                )}
                                <p className="text-[10px] text-center text-gray-500">Test Mode: Payment is simulated if no NWC</p>
                            </div>
                        </form>
                    )}
                </div>

            </div>
        </main>
    );
}
