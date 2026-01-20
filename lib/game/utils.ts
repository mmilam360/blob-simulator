import { Blob } from './PhysicsEngine';

export const generateRandomColor = () => {
    const h = Math.floor(Math.random() * 360);
    return `hsl(${h}, 70%, 50%)`;
};

export const createBlob = (
    id: string,
    width: number,
    height: number,
    sizeValue: number, // based on payment
    name?: string,
    payoutAddress?: string
): Blob => {
    const minRadius = 10;
    const radius = minRadius + Math.sqrt(sizeValue) * 2;

    return {
        id,
        x: Math.random() * (width - radius * 2) + radius,
        y: Math.random() * (height - radius * 2) + radius,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        radius,
        color: generateRandomColor(),
        mass: radius,
        name: name || `Blob-${id.slice(0, 4)}`,
        payoutAddress
    };
};
