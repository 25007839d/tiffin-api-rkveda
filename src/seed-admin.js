import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import {pool} from './db.js';
dotenv.config();
const mobile=process.env.ADMIN_MOBILE||'9999999999';
const password=process.env.ADMIN_PASSWORD||'ChangeMe@123';
const hash=await bcrypt.hash(password,10);
await pool.query(
 `INSERT INTO admins(name,mobile,password_hash,role) VALUES('RKVeda Admin',?,?, 'super_admin')
  ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash),role='super_admin',active=1`,
 [mobile,hash]
);
console.log(`Admin ready. Mobile: ${mobile}`);
await pool.end();
