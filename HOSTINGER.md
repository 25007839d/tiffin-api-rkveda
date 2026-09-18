# RKVeda Tiffin - Hostinger deployment

## Backend
1. Deploy this repository as a Node.js Web App on Hostinger.
2. Run `npm install`.
3. Start with `npm start`.
4. Create/import the MySQL database using `database_schema.sql`.
5. In Hostinger environment variables, set:
   - `DB_HOST=localhost` (when the database is on the same Hostinger account/server and Hostinger provides localhost)
   - `DB_NAME`, `DB_USER`, `DB_PASSWORD`
   - a long random `JWT_SECRET`
   - `FRONTEND_URL=https://tiffin.rkveda.in`
   - `API_PUBLIC_URL=https://tiffin-api.rkveda.in`
   - `PAYMENT_GATEWAY=cashfree`
   - Cashfree variables shown in `.env.example`
6. Ensure `public/uploads` is writable.
7. Run `npm run seed-admin` once.
8. Point `tiffin-api.rkveda.in` to the API app.

## Cashfree
Sandbox:
- API base: `https://sandbox.cashfree.com/pg`
- API version: `2025-01-01`

Production:
- API base: `https://api.cashfree.com/pg`
- API version: `2025-01-01`

Cashfree webhook:
`https://tiffin-api.rkveda.in/api/payments/cashfree/webhook`

For production, configure the same webhook URL in Cashfree's Production environment and use the Production client ID/secret. Do not put secrets in React/Vite environment variables.

## Frontend requirement
The backend returns `payment_session_id` from `/api/payments/create`. The React frontend must load Cashfree JS SDK v3 and call `cashfree.checkout({ paymentSessionId })`. After the checkout callback/return, call `/api/payments/verify` so the backend verifies the order status. Cashfree's documentation recommends server-side status verification and signed webhook validation.

## Existing Razorpay
The old Razorpay implementation has been removed from the active payment route. This version is Cashfree-first. The `payments` table remains gateway-agnostic so existing historical records are not changed.
