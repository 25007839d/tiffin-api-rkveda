# API endpoints

Base: `/api`

Public:
- GET `/health`
- POST `/auth/register`
- POST `/auth/login`
- POST `/auth/admin-login`
- GET `/menu/weekly`
- GET `/menu/today`
- GET `/plans`

Customer JWT:
- GET `/customer/profile`
- POST `/customer/addresses`
- GET `/customer/orders`
- GET `/customer/subscriptions`
- POST `/orders`
- POST `/payments/create`
- POST `/payments/verify`

Razorpay:
- POST `/payments/webhook`

Admin JWT:
- GET `/admin/dashboard`
- GET `/admin/orders`
- PATCH `/admin/orders/:id/status`
- GET `/admin/customers`
- GET `/admin/payments`
- GET `/admin/subscriptions`
- GET `/admin/menu`
- PUT `/admin/menu/:id` (multipart: lunch_image, dinner_image)
- GET `/admin/plans`
- POST `/admin/plans`
- PUT `/admin/plans/:id`
