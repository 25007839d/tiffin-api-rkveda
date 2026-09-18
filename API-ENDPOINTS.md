# RKVeda Tiffin API endpoints

Base: `https://tiffin-api.rkveda.in/api`

## Public
- GET `/health`
- POST `/auth/register`
- POST `/auth/login`
- POST `/auth/admin-login`
- GET `/menu/weekly`
- GET `/menu/today`
- GET `/plans`

## Customer JWT
- GET `/customer/profile`
- POST `/customer/addresses`
- GET `/customer/orders`
- GET `/customer/subscriptions`
- POST `/orders`
- POST `/payments/create` — creates a Cashfree payment order when `PAYMENT_GATEWAY=cashfree`
- POST `/payments/verify` — server-side Cashfree order verification/sync
- GET `/payments/cashfree/status/:orderId` — server-side payment status check

## Cashfree
- POST `/payments/cashfree/webhook`

Cashfree webhook URL:
`https://tiffin-api.rkveda.in/api/payments/cashfree/webhook`

## Admin JWT
- GET `/admin/dashboard`
- GET `/admin/orders`
- PATCH `/admin/orders/:id/status`
- PUT `/admin/orders/:id` — update order status/notes
- DELETE `/admin/orders/:id` — delete an order
- GET `/admin/customers`
- PUT `/admin/customers/:id` — update customer details
- DELETE `/admin/customers/:id` — deactivate customer (preserves order history)
- GET `/admin/payments`
- GET `/admin/subscriptions`
- GET `/admin/menu`
- PUT `/admin/menu/:id` (multipart: `lunch_image`, `dinner_image`)
- GET `/admin/plans`
- POST `/admin/plans`
- PUT `/admin/plans/:id`

## Cashfree payment flow
1. Customer creates an order with `POST /orders`.
2. Frontend calls `POST /payments/create` with `{ "order_id": <internalOrderId> }`.
3. Backend creates a Cashfree order using API version `2025-01-01` and returns `payment_session_id`.
4. Frontend opens Cashfree JS checkout with that session.
5. After checkout, frontend calls `POST /payments/verify` with the internal order ID.
6. Backend verifies the status against Cashfree's server-side API and updates MySQL.
7. Cashfree webhook independently updates the payment when a valid signed webhook arrives.

Never expose `CASHFREE_CLIENT_SECRET` or `CASHFREE_WEBHOOK_SECRET` to the frontend.
