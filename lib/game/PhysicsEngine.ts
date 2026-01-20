export interface Blob {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    color: string;
    mass: number;
    name?: string;
    payoutAddress?: string;
}

export class PhysicsEngine {
    width: number;
    height: number;
    blobs: Blob[];

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.blobs = [];
    }

    addBlob(blob: Blob) {
        this.blobs.push(blob);
    }

    update() {
        // 1. Move Blobs
        this.blobs.forEach((blob) => {
            blob.x += blob.vx;
            blob.y += blob.vy;

            // Wall Collisions
            if (blob.x - blob.radius < 0) {
                blob.x = blob.radius;
                blob.vx *= -1;
            }
            if (blob.x + blob.radius > this.width) {
                blob.x = this.width - blob.radius;
                blob.vx *= -1;
            }
            if (blob.y - blob.radius < 0) {
                blob.y = blob.radius;
                blob.vy *= -1;
            }
            if (blob.y + blob.radius > this.height) {
                blob.y = this.height - blob.radius;
                blob.vy *= -1;
            }
        });

        // 2. Resolve Collisions & Absorption
        // We iterate backwards to safely remove blobs
        for (let i = this.blobs.length - 1; i >= 0; i--) {
            for (let j = i - 1; j >= 0; j--) {
                const b1 = this.blobs[i];
                const b2 = this.blobs[j];

                const dx = b2.x - b1.x;
                const dy = b2.y - b1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < b1.radius + b2.radius) {
                    // Collision detected!
                    this.handleCollision(i, j);
                }
            }
        }
    }

    handleCollision(idx1: number, idx2: number) {
        const b1 = this.blobs[idx1];
        const b2 = this.blobs[idx2];

        // Safety check if they were already removed
        if (!b1 || !b2) return;

        // Bigger eats smaller
        let predator: Blob;
        let prey: Blob;
        let preyIdx: number;

        if (b1.radius > b2.radius) {
            predator = b1;
            prey = b2;
            preyIdx = idx2;
        } else if (b2.radius > b1.radius) {
            predator = b2;
            prey = b1;
            preyIdx = idx1;
        } else {
            if (Math.random() > 0.5) {
                predator = b1;
                prey = b2;
                preyIdx = idx2;
            } else {
                predator = b2;
                prey = b1;
                preyIdx = idx1;
            }
        }

        // Absorption
        const newRadius = Math.sqrt(Math.pow(predator.radius, 2) + Math.pow(prey.radius, 2));

        predator.radius = newRadius;
        predator.mass += prey.mass;

        // Momentum
        predator.vx = (predator.mass * predator.vx + prey.mass * prey.vx) / (predator.mass + prey.mass);
        predator.vy = (predator.mass * predator.vy + prey.mass * prey.vy) / (predator.mass + prey.mass);

        // Remove prey
        this.blobs.splice(preyIdx, 1);
    }
}
