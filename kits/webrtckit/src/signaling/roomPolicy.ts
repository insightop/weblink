/**
 * Lexicographic compare: smaller peerId is "polite" for perfect negotiation (pairwise).
 */
export function isPolitePeer(localPeerId: string, remotePeerId: string): boolean {
  return localPeerId < remotePeerId;
}
