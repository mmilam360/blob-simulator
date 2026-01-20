import { useEffect, useRef, useState } from 'react';
import { PhysicsEngine, Blob } from '@/lib/game/PhysicsEngine';

export const useGameLoop = (width: number, height: number, active: boolean) => {
    const engineRef = useRef<PhysicsEngine | null>(null);
    const requestRef = useRef<number>();
    const [blobs, setBlobs] = useState<Blob[]>([]);

    // Initialize engine
    useEffect(() => {
        if (!engineRef.current && width > 0 && height > 0) {
            engineRef.current = new PhysicsEngine(width, height);
        }
    }, [width, height]);

    // Game Loop
    const animate = () => {
        if (engineRef.current && active) {
            engineRef.current.update();
            setBlobs([...engineRef.current.blobs]); // Trigger render
        }
        requestRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current!);
    }, [active]);

    const addBlob = (blob: Blob) => {
        engineRef.current?.addBlob(blob);
    };

    const resetGame = () => {
        if (engineRef.current) {
            engineRef.current.blobs = [];
            setBlobs([]);
        }
    }

    return { blobs, addBlob, resetGame };
};
