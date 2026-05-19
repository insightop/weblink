import type { StlinkTargetVariant } from "@/transports/adapters/stlink.adapter";

/** In-memory session only; cleared on refresh or when target/flasher/firmware changes. */
export interface StlinkTargetPreferenceV1 {
  dontAsk: boolean;
  selectedType: string;
  candidatesSignature: string;
}

export function signatureForCandidates(candidates: StlinkTargetVariant[]): string {
  return JSON.stringify(
    [...new Set(candidates.map((c) => c.type))].sort((a, b) => a.localeCompare(b)),
  );
}

export function createStlinkTargetSession(
  candidates: StlinkTargetVariant[],
  selectedType: string,
): StlinkTargetPreferenceV1 {
  return {
    dontAsk: true,
    selectedType,
    candidatesSignature: signatureForCandidates(candidates),
  };
}

export function tryAutoPickTarget(
  session: StlinkTargetPreferenceV1 | null,
  candidates: StlinkTargetVariant[],
): string | null {
  if (!session?.dontAsk || !session.selectedType || !session.candidatesSignature) return null;
  if (session.candidatesSignature !== signatureForCandidates(candidates)) return null;
  if (!candidates.some((c) => c.type === session.selectedType)) return null;
  return session.selectedType;
}
