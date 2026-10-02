# Stripe Invoice Status Checker

See all unpaid Stripe invoices at a glance: status, days overdue, amount owed. $19/month.

Next.js 15 (App Router) · Stripe Connect OAuth (read-only) · no database · Vercel.

## Routes

| Path                  | What it does                                                                           |
| --------------------- | -------------------------------------------------------------------------------------- |
| `/`                   | Landing page with pricing CTA and an embedded sample dashboard (15 invoices)           |
| `/demo`               | Full demo dashboard on sample data (filters, sort, sync all work)                      |
| `/connect`            | "Connect with Stripe" (OAuth) or paste a restricted key (Invoices: Read)               |
| `/dashboard`          | Live dashboard for the connected account                                               |
| `/api/auth/stripe`    | Starts Stripe Connect OAuth (`scope=read_only`, CSRF state cookie)                     |
| `/api/auth/callback`  | Exchanges the code, seals the token into an httpOnly AES-GCM cookie (8h)               |
| `/api/auth/logout`    | Clears the session cookie                                                              |
| `/api/invoices`       | Fetches all non-draft invoices (paginated, up to 1,000) using the session or `x-stripe-key` |

## Status logic

| Label          | Rule                                                                 |
| -------------- | -------------------------------------------------------------------- |
| Paid           | Stripe `status = paid`                                               |
| Partially paid | `status = open` and `amount_paid > 0`                                |
| Unpaid         | `status = open`, nothing paid; "days overdue" counts past `due_date` |
| Expired        | `status = uncollectible` or `void`                                   |

Drafts are hidden. Default sort: anything still owed first, most overdue at the top.

## Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable                          | Required for         | Notes                                                                                     |
| --------------------------------- | -------------------- | ----------------------------------------------------------------------------------------- |
| `STRIPE_CLIENT_ID`                | OAuth connect        | `ca_…` from Stripe Dashboard → Settings → Connect → Onboarding options → OAuth            |
| `STRIPE_SECRET_KEY`               | OAuth connect        | Platform secret key; only used server-side for the token exchange                         |
| `SESSION_SECRET`                  | OAuth connect        | Long random string for cookie encryption (falls back to `STRIPE_SECRET_KEY`)              |
| `NEXT_PUBLIC_STRIPE_PAYMENT_LINK` | Paid CTA             | `https://buy.stripe.com/…` for the $19/month product. Needs a redeploy (build-time value) |
| `APP_URL`                         | optional             | Override public origin for the OAuth redirect URI                                         |

Register the OAuth redirect URI in Stripe as `https://<domain>/api/auth/callback`.

Until the OAuth variables are set, `/connect` still works via a **restricted API key** (Stripe → Developers → API keys →
Create restricted key → Invoices: Read). The key is kept in the browser's `sessionStorage` only and proxied through
`/api/invoices`; full `sk_` secret keys are rejected.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev
```
