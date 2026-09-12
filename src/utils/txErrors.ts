/**
 * Turn a wallet / viem / contract failure into one readable sentence.
 * viem errors carry a `shortMessage` (and often a nested `cause` with the
 * revert reason); MetaMask rejections say "User rejected the request".
 */
export function describeTxError(err: unknown, prefix: string): string {
  const e = err as
    | { shortMessage?: string; message?: string; cause?: { shortMessage?: string; message?: string } }
    | null;
  const raw = e?.cause?.shortMessage || e?.shortMessage || e?.cause?.message || e?.message || String(err);

  if (/user rejected|user denied|rejected the request/i.test(raw)) return 'Transaction rejected in your wallet';
  if (/insufficient.*balance|exceeds.*balance|InsufficientBalance|not enough copies/i.test(raw)) {
    return "You don't hold that many copies of this NFT";
  }
  if (/not approved|NotApproved|missing approval|caller is not owner nor approved/i.test(raw)) {
    return 'The marketplace is not approved to move your NFT yet. Try again to grant approval.';
  }
  if (/insufficient funds/i.test(raw)) return 'Not enough TEST in your wallet to pay for gas';
  if (/paused|EnforcedPause/i.test(raw)) return 'The marketplace contract is paused right now. Try again later.';

  const trimmed = raw.replace(/\s+/g, ' ').trim();
  return `${prefix}: ${trimmed.length > 160 ? `${trimmed.slice(0, 157)}...` : trimmed}`;
}
