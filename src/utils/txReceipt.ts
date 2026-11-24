import type { PublicClient } from 'viem';

/**
 * Wait for a transaction receipt and verify the transaction actually
 * SUCCEEDED. viem's waitForTransactionReceipt resolves for reverted
 * transactions too (receipt.status === 'reverted'), so a caller that only
 * awaits it will happily show a success message for a tx that failed
 * on-chain. Every success path must go through this check.
 *
 * Throws when no client is available (can't verify ⇒ never claim success)
 * or when the transaction reverted. `what` names the action for the error
 * message, e.g. 'purchase' / 'delist' / 'review'.
 */
export async function waitForTxSuccess(
  client: Pick<PublicClient, 'waitForTransactionReceipt'> | undefined | null,
  hash: `0x${string}`,
  what: string,
): Promise<void> {
  if (!client) {
    throw new Error(`Cannot verify the ${what} transaction: no RPC client available. Refresh and check your wallet.`);
  }
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') {
    throw new Error(`The ${what} transaction was reverted on-chain. Nothing was changed.`);
  }
}
