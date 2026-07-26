# Lightning Explorer

A web explorer for the Bitcoin Lightning Network, backed by the [Boltz](https://boltz.exchange) API.

## Features

- **Search** nodes by alias, pubkey, or channel ID
- **Inspect** node details and their channels
- **Decode** BOLT11 invoices and BOLT12 offers/invoices, then jump to the nodes behind them
- **Resolve** Lightning Addresses (LNURL) and [BIP-353](https://github.com/bitcoin/bips/blob/master/bip-0353.mediawiki) names (DNSSEC-verified in-browser) and fetch invoices from them

## Development

Requires Node.js 22+.

```sh
npm install
npm run dev      # start the dev server
npm run build    # type-check and build for production
npm run preview  # serve the production build
```

## Testing

```sh
npm run test          # unit tests (Vitest)
npm run test:coverage # unit tests with coverage
npm run test:e2e      # end-to-end tests (Playwright, hits the production API)
```

## Configuration

All optional, set via environment variables (e.g. in a `.env` file):

| Variable              | Default                       | Description                     |
| --------------------- | ----------------------------- | ------------------------------- |
| `VITE_API_URL`        | `https://api.boltz.exchange`  | Boltz API endpoint              |
| `VITE_CURRENCY`       | `BTC`                         | Currency to query               |
| `VITE_DNS_OVER_HTTPS` | `https://1.1.1.1/dns-query`   | DNS-over-HTTPS resolver for BIP-353 |
