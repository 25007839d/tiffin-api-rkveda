import express from 'express';import cors from 'cors';import helmet from 'helmet';import dotenv from 'dotenv';import fs from 'fs';import path from 'path';
import authRoutes from './routes/auth.js';import menuRoutes from './routes/menu.js';import planRoutes from './routes/plans.js';
import orderRoutes from './routes/orders.js';import paymentRoutes from './routes/payments.js';import adminRoutes from './routes/admin.js';import customerRoutes from './routes/customer.js';
dotenv.config();const app=express();const port=Number(process.env.PORT||5000);
fs.mkdirSync(path.resolve(process.env.UPLOAD_DIR||'public/uploads'),{recursive:true});
app.use(helmet({crossOriginResourcePolicy:false}));
app.use(cors({origin:process.env.FRONTEND_URL?.split(',').map(x=>x.trim())||true,credentials:true}));
app.use('/api/payments/webhook',express.raw({type:'application/json',limit:'1mb'}));
app.use('/api/payments/cashfree/webhook',express.raw({type:'application/json',limit:'1mb'}));
app.use(express.json({limit:'2mb'}));app.use(express.urlencoded({extended:true}));
app.use('/uploads',express.static(path.resolve(process.env.UPLOAD_DIR||'public/uploads')));
app.get('/api/health',(req,res)=>res.json({ok:true,service:'rkveda-tiffin-api'}));

// Backward-compatible non-/api aliases.
// The currently deployed frontend has been observed calling /health, /order
// and /customer/... directly, while the documented API uses /api/....
app.get('/health',(req,res)=>res.json({ok:true,service:'rkveda-tiffin-api'}));

app.use('/api/auth',authRoutes);
app.use('/api/menu',menuRoutes);
app.use('/api/plans',planRoutes);
app.use('/api/orders',orderRoutes);
app.use('/api/payments',paymentRoutes);
app.use('/api/admin',adminRoutes);
app.use('/api/customer',customerRoutes);

// Compatibility aliases for the current frontend deployment.
app.use('/auth',authRoutes);
app.use('/menu',menuRoutes);
app.use('/plans',planRoutes);
app.use('/order',orderRoutes);
app.use('/orders',orderRoutes);
app.use('/payments',paymentRoutes);
app.use('/admin',adminRoutes);
app.use('/customer',customerRoutes);
app.use((err,req,res,next)=>{console.error(err);res.status(err.status||500).json({message:err.message||'Server error'})});
app.listen(port,()=>console.log(`RKVeda Tiffin API on ${port}`));
