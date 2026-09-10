# Payment recovery — stranded NOWPayments / AgentMail

Operator + Grok Bot / AgentMail runbook for **on-chain paid, unlock missing** cases on sheundresses.com.

**Inbox:** `contact@sheundresses.com` → AgentMail `dswmarketingllc@agentmail.to`  
**Do not** put operator personal Gmail on public templates — always `contact@`.

---

## Context

Checkout uses **NOWPayments**. Exchange withdrawals (e.g. Coinbase → SOL) often land **slightly under** exact `pay_amount`. IPN may stick at `partially_paid` / never `finished`. Checkout UI can flash **“Invoice not found.”**

Customer paid on-chain; vault unlocks are missing. Settlement code already allows ~**2% underpay** (`actually_paid >= pay_amount * 0.98`) when IPN is valid — recovery is for when IPN never finishes but the chain tx is real.

Relevant fields (Neon `invoices`): `pay_address`, `crypto_amount`, `provider_payment_id`, `status`, `tx_hash`, `wallet_address`, `user_id`, linked `shot_ids` / line items. Operator settle path: admin `operatorGrantInvoice` (marks confirming → settle → grants shots on **that invoice only**).

---

## Customer path

Tell them to email **contact@sheundresses.com** and include:

1. Account email used on the site  
2. Shot / ladder if known  
3. Asset (SOL / ETH / …)  
4. Exact pay address from checkout (if they still have it)  
5. Blockchain txid  
6. Screenshot of checkout crash / invoice / Coinbase (or exchange) send confirmation  
7. Approx time + timezone  

Acknowledge receipt. **Never ask them to pay again** until the payment is matched or proven unmatched.

---

## Agent protocol

1. **Acknowledge** the ticket. Do not request a second payment until matched.  
2. **Lookup invoice in Neon** by (in order of preference):  
   - `pay_address`  
   - `provider_payment_id`  
   - user email → `user_id` + amount/time window  
   - amount + time window alone (last resort; be careful of twins)  
3. **Verify tx on-chain** (Solana explorer / Etherscan / etc.): destination address, amount, success/finalized.  
4. **Compare** received amount to invoice `crypto_amount` / NOWPayments `pay_amount`. Allow ~**2% underpay** (same tolerance as IPN). Currency must match.  
5. **If proven:**  
   - Mark **that one** invoice paid / settle via operator grant (`operatorGrantInvoice` or equivalent DB settle + grants).  
   - Store `tx_hash` (and wallet if useful).  
   - Grant unlocks for **`shot_ids` on that invoice only**.  
   - Leave unrelated pending invoices unpaid.  
6. **Reply via AgentMail** with confirmation, which shots unlocked, and hard-refresh instructions (sign out/in or hard refresh vault).  
7. **If not proven:** say exactly what is missing. **Do not invent unlocks.**

Log what was looked up, which invoice id was settled, txid, and what was unlocked.

---

## Safety

- **One invoice only** — do not unlock a twin / nearby pending invoice with a different address or amount.  
- **No secrets** in email replies (no API keys, DB URLs, IPN secrets, Blob tokens).  
- Public templates use **`contact@sheundresses.com` only** — never operator personal Gmail.  
- Log actions for ops audit (invoice id, txid, shot ids, agent/operator).

---

## Template reply snippets

### Need more info

> Thanks for writing contact@sheundresses.com. We can match an on-chain payment that did not finish in checkout, but we still need: (1) the account email you used on sheundresses.com, (2) the pay address from checkout if you have it, (3) the blockchain txid, and (4) which asset (SOL/ETH/…). Please do **not** send another payment until we confirm this one.

### Unlocked

> Confirmed: your payment landed on-chain and we matched invoice \<id\>. Unlocked: \<shot titles / steps\>. Please hard-refresh the vault (or sign out and back in). If a frame still looks locked after refresh, reply with a screenshot and we will re-check that invoice only.

### Cannot verify

> We could not verify an on-chain payment that matches your invoice yet. Missing / unmatched: \<pay address | txid | amount | destination\>. Reply with those details and we will look again. We will not unlock until the chain transfer matches the invoice (including the ~2% underpay tolerance used by checkout).

---

## Optional — public FAQ /legal blurb (not required to ship UI)

> **Paid on-chain but unlock missing?** Exchange withdrawals sometimes send slightly less than the exact checkout amount, so the payment processor may not mark the invoice finished even though the blockchain transfer succeeded. Email **contact@sheundresses.com** with your site account email, pay address, txid, asset, and approx time (timezone). Do not send a second payment until we reply. We match one invoice at a time after on-chain verification.

