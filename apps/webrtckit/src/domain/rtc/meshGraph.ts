/**
 * Tracks which remote peer IDs should have an active RTCPeerConnection (full mesh).
 */
export class MeshGraph {
  private readonly remotes = new Set<string>();
  private readonly localPeerId: string;

  constructor(localPeerId: string) {
    this.localPeerId = localPeerId;
  }

  getRemotes(): ReadonlySet<string> {
    return this.remotes;
  }

  addPeer(remotePeerId: string): boolean {
    if (remotePeerId === this.localPeerId) return false;
    if (this.remotes.has(remotePeerId)) return false;
    this.remotes.add(remotePeerId);
    return true;
  }

  removePeer(remotePeerId: string): boolean {
    return this.remotes.delete(remotePeerId);
  }

  shouldConnectTo(remotePeerId: string): boolean {
    return remotePeerId !== this.localPeerId && this.remotes.has(remotePeerId);
  }
}
