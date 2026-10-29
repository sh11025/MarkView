import { create } from 'zustand';
import type { DocumentPosition } from '../features/position/positions';

interface PositionsState {
  positions: Record<string, DocumentPosition>;
  hydrate(positions: Record<string, DocumentPosition>): void;
  update(id: string, pos: DocumentPosition): void;
  remove(id: string): void;
}

export const usePositions = create<PositionsState>((set) => ({
  positions: {},
  hydrate: (positions) => set({ positions }),
  update: (id, pos) => set((s) => ({ positions: { ...s.positions, [id]: pos } })),
  remove: (id) =>
    set((s) => {
      if (!s.positions[id]) return s;
      const rest = { ...s.positions };
      delete rest[id];
      return { positions: rest };
    }),
}));
