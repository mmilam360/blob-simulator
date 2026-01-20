'use client';
import React, { useRef, useEffect, useState } from 'react';
import { useGameLoop } from '@/lib/hooks/useGameLoop';
import { createBlob } from '@/lib/game/utils';

interface GameCanvasProps {
    active: boolean;
    onGameInit?: (methods: { addBlob: any, resetGame: any }) => void;
    onWinner?: (blob: any) => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ active, onGameInit, onWinner }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

    const { blobs, addBlob, resetGame } = useGameLoop(dimensions.width, dimensions.height, active);

    // Track start to avoid immediate win if only 1 blob added
    const maxBlobsRef = useRef(0);

    useEffect(() => {
        if (onGameInit) {
            onGameInit({
                addBlob: (size: number, name: string, payoutAddress?: string) => {
                    const newBlob = createBlob(crypto.randomUUID(), dimensions.width, dimensions.height, size, name, payoutAddress);
                    addBlob(newBlob);
                },
                resetGame
            });
        }
    }, [onGameInit, dimensions]);

    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight,
                });
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, dimensions.width, dimensions.height);

            blobs.forEach((blob) => {
                ctx.beginPath();
                ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
                ctx.fillStyle = blob.color;

                ctx.shadowColor = blob.color;
                ctx.shadowBlur = 15;
                ctx.fill();
                ctx.shadowBlur = 0;

                ctx.closePath();

                if (blob.name) {
                    ctx.fillStyle = 'white';
                    ctx.font = '12px Inter';
                    ctx.textAlign = 'center';
                    ctx.fillText(blob.name, blob.x, blob.y + 4);
                }
            });
        }
    }, [blobs, dimensions]);

    // Winner Detection Logic
    useEffect(() => {
        if (!active) {
            maxBlobsRef.current = 0;
        } else {
            if (blobs.length > maxBlobsRef.current) maxBlobsRef.current = blobs.length;

            // Only declare winner if we had at least 2 blobs battling and now only 1 remains
            if (maxBlobsRef.current > 1 && blobs.length === 1) {
                if (onWinner) onWinner(blobs[0]);
            }
        }
    }, [blobs, active, onWinner]);

    return (
        <div ref={containerRef} className="w-full h-full min-h-[500px] bg-gray-900 rounded-xl overflow-hidden shadow-2xl relative border border-gray-800">
            <canvas
                ref={canvasRef}
                width={dimensions.width}
                height={dimensions.height}
                className="block"
            />
            {!active && blobs.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-white/50 bg-black/40 backdrop-blur-sm pointer-events-none">
                    <p className="text-xl font-light tracking-wide">Waiting for players...</p>
                </div>
            )}
        </div>
    );
};

export default GameCanvas;
