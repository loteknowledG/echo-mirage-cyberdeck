/** Call Station — pairing-only room registry (matchmaker truth store). */

export type CallStationRole = "echo" | "mirage" | "powerfist" | "any";

export type CallStationRoomStatus = "waiting" | "matched" | "expired";

export type CallStationRoom = {
  roomId: string;
  /** Short human code for voice / AI answers (e.g. K7M2). */
  code: string;
  waitingAs: CallStationRole;
  label: string;
  createdAt: string;
  expiresAt: string;
  status: CallStationRoomStatus;
  matchedRoomId?: string;
  matchedAt?: string;
};

export type CallStationStore = {
  rooms: Record<string, CallStationRoom>;
};
