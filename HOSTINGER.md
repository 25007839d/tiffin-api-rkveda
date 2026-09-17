# Hostinger deployment

## API: tiffin-api.rkveda.in
1. Create a Node.js Web App.
2. Deploy the `api` folder/repository.
3. Run `npm install`.
4. Start with `npm start`.
5. Create MySQL database in hPanel and import `database/schema.sql`.
6. Create production environment variables from `api/.env.example`.
7. Run `npm run seed-admin` once with your chosen ADMIN_MOBILE and ADMIN_PASSWORD.
8. Ensure `public/uploads` is writable.
9. Point `tiffin-api.rkveda.in` to the API app.
10. Configure Razorpay webhook:
   `https://tiffin-api.rkveda.in/api/payments/webhook`

## Frontend: tiffin.rkveda.in
1. Create a Node.js Web App or static deployment.
2. Set build env:
   `VITE_API_BASE_URL=https://tiffin-api.rkveda.in/api`
   `VITE_API_ORIGIN=https://tiffin-api.rkveda.in`
3. Run `npm install` and `npm run build`.
4. Serve `dist`.
5. Point `tiffin.rkveda.in` to the frontend.

## Production checklist
- Change the default admin password.
- Use a long random JWT_SECRET.
- Keep Razorpay secret/webhook secret only on the API server.
- Test Razorpay in test mode before live mode.
- Enable HTTPS.
- Back up MySQL.
- Restrict admin access.
