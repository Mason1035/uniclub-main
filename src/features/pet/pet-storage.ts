export interface PetPosition { x: number; viewportWidth: number; facing: 1 | -1 }
const positionKey = (userId: string) => `classhub:pet-position:${userId}`;

export function readPetPosition(userId: string): PetPosition | null {
  try {
    const raw = localStorage.getItem(positionKey(userId));
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.viewportWidth) || value.viewportWidth <= 0) return null;
    return { x: Math.max(0, value.x), viewportWidth: value.viewportWidth, facing: value.facing === -1 ? -1 : 1 };
  } catch { return null; }
}

export function savePetPosition(userId: string, position: PetPosition): void {
  try { localStorage.setItem(positionKey(userId), JSON.stringify(position)); } catch { /* pet remains usable */ }
}

export function clearPetPosition(userId: string): void {
  try { localStorage.removeItem(positionKey(userId)); } catch { /* pet remains usable */ }
}
