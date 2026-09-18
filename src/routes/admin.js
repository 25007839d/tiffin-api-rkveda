import {Router} from 'express';import multer from 'multer';import path from 'path';import {pool} from '../db.js';import {auth,admin} from '../auth.js';const r=Router();r.use(auth,admin);
const dir=path.resolve(process.env.UPLOAD_DIR||'public/uploads');const storage=multer.diskStorage({destination:dir,filename:(q,f,cb)=>cb(null,`menu-${Date.now()}-${Math.round(Math.random()*1e9)}${path.extname(f.originalname).toLowerCase()}`)});
const upload=multer({storage,limits:{fileSize:5*1024*1024},fileFilter:(q,f,cb)=>cb(null,['image/jpeg','image/png','image/webp','image/gif'].includes(f.mimetype))});
r.get('/dashboard',async(q,s,n)=>{try{const[[o]]=await pool.query(`SELECT COUNT(*) total FROM orders WHERE DATE(created_at)=CURDATE()`),[[l]]=await pool.query(`SELECT COALESCE(SUM(quantity),0) total FROM orders WHERE DATE(created_at)=CURDATE() AND meal_type IN ('lunch','both') AND payment_status='paid'`),[[d]]=await pool.query(`SELECT COALESCE(SUM(quantity),0) total FROM orders WHERE DATE(created_at)=CURDATE() AND meal_type IN ('dinner','both') AND payment_status='paid'`),[[v]]=await pool.query(`SELECT COALESCE(SUM(total_amount),0) total FROM orders WHERE DATE(created_at)=CURDATE() AND payment_status='paid'`),[[c]]=await pool.query(`SELECT COUNT(*) total FROM customers WHERE active=1`),[[sub]]=await pool.query(`SELECT COUNT(*) total FROM subscriptions WHERE status='active'`),[[p]]=await pool.query(`SELECT COUNT(*) total FROM orders WHERE payment_status='pending'`);s.json({orders:o.total,lunch:l.total,dinner:d.total,revenue:v.total,customers:c.total,subscriptions:sub.total,pendingPayments:p.total})}catch(e){n(e)}});
r.get('/orders',async(q,s,n)=>{try{const[x]=await pool.query(`SELECT o.*,c.name customer_name,c.mobile,a.address_line1,a.area,a.city,a.pincode,p.name plan_name FROM orders o JOIN customers c ON c.id=o.customer_id JOIN addresses a ON a.id=o.address_id LEFT JOIN plans p ON p.id=o.plan_id ORDER BY o.created_at DESC LIMIT 500`);s.json(x)}catch(e){n(e)}});
r.patch('/orders/:id/status',async(q,s,n)=>{try{const ok=['pending','confirmed','preparing','out_for_delivery','delivered','cancelled'];if(!ok.includes(q.body.status))return s.status(400).json({message:'Invalid status'});await pool.query('UPDATE orders SET order_status=? WHERE id=?',[q.body.status,q.params.id]);s.json({success:true})}catch(e){n(e)}});
r.get('/customers',async(q,s,n)=>{try{const[x]=await pool.query(`SELECT c.id,c.name,c.mobile,c.email,c.active,c.created_at,COUNT(o.id) orders_count,COALESCE(SUM(CASE WHEN o.payment_status='paid' THEN o.total_amount ELSE 0 END),0) total_spent FROM customers c LEFT JOIN orders o ON o.customer_id=c.id GROUP BY c.id ORDER BY c.created_at DESC`);s.json(x)}catch(e){n(e)}});
r.get('/payments',async(q,s,n)=>{try{const[x]=await pool.query(`SELECT p.*,o.order_number,c.name customer_name,c.mobile FROM payments p JOIN orders o ON o.id=p.order_id JOIN customers c ON c.id=p.customer_id ORDER BY p.created_at DESC LIMIT 500`);s.json(x)}catch(e){n(e)}});
r.get('/subscriptions',async(q,s,n)=>{try{const[x]=await pool.query(`SELECT s.*,c.name customer_name,c.mobile,p.name plan_name,p.meal_type,p.duration_days FROM subscriptions s JOIN customers c ON c.id=s.customer_id JOIN plans p ON p.id=s.plan_id ORDER BY s.created_at DESC LIMIT 500`);s.json(x)}catch(e){n(e)}});
r.get('/menu',async(q,s,n)=>{try{const[x]=await pool.query('SELECT * FROM menu_days ORDER BY day_of_week');s.json(x)}catch(e){n(e)}});
r.put('/menu/:id',upload.fields([{name:'lunch_image',maxCount:1},{name:'dinner_image',maxCount:1}]),async(q,s,n)=>{try{const d=q.body,fs=q.files||{},[x]=await pool.query('SELECT * FROM menu_days WHERE id=?',[q.params.id]);if(!x.length)return s.status(404).json({message:'Menu day not found'});const old=x[0],lu=fs.lunch_image?.[0]?`/uploads/${fs.lunch_image[0].filename}`:(d.lunch_image_url||old.lunch_image_url),du=fs.dinner_image?.[0]?`/uploads/${fs.dinner_image[0].filename}`:(d.dinner_image_url||old.dinner_image_url);await pool.query(`UPDATE menu_days SET lunch_dal=?,lunch_dry_sabzi=?,lunch_rice=?,lunch_salad=?,lunch_raita=?,lunch_image_url=?,dinner_dal=?,dinner_dry_sabzi=?,dinner_rice=?,dinner_salad=?,dinner_raita=?,dinner_image_url=?,active=? WHERE id=?`,[d.lunch_dal,d.lunch_dry_sabzi,d.lunch_rice,d.lunch_salad,d.lunch_raita,lu,d.dinner_dal,d.dinner_dry_sabzi,d.dinner_rice,d.dinner_salad,d.dinner_raita,du,d.active==='0'?0:1,q.params.id]);s.json({success:true})}catch(e){n(e)}});
r.get('/plans',async(q,s,n)=>{try{const[x]=await pool.query('SELECT * FROM plans ORDER BY sort_order,id');s.json(x)}catch(e){n(e)}});
r.post('/plans',async(q,s,n)=>{try{const{x}=q.body;const[y]=await pool.query('INSERT INTO plans(name,duration_days,meal_type,price,description,active,sort_order) VALUES(?,?,?,?,?,?,?)',[x.name,x.duration_days,x.meal_type,x.price,x.description||null,x.active??1,x.sort_order??0]);s.status(201).json({id:y.insertId})}catch(e){n(e)}});
r.put('/plans/:id',async(q,s,n)=>{try{const{x}=q.body;await pool.query('UPDATE plans SET name=?,duration_days=?,meal_type=?,price=?,description=?,active=?,sort_order=? WHERE id=?',[x.name,x.duration_days,x.meal_type,x.price,x.description||null,x.active,x.sort_order,q.params.id]);s.json({success:true})}catch(e){n(e)}});

r.put('/orders/:id',async(q,s,n)=>{
  try{
    const {status,notes}=q.body||{};
    const ok=['pending','confirmed','preparing','out_for_delivery','delivered','cancelled'];
    if(status!==undefined && !ok.includes(status)) return s.status(400).json({message:'Invalid status'});
    const sets=[],vals=[];
    if(status!==undefined){sets.push('order_status=?');vals.push(status);}
    if(notes!==undefined){sets.push('notes=?');vals.push(notes||null);}
    if(!sets.length)return s.status(400).json({message:'Nothing to update'});
    vals.push(q.params.id);
    const [x]=await pool.query(`UPDATE orders SET ${sets.join(',')} WHERE id=?`,vals);
    if(!x.affectedRows)return s.status(404).json({message:'Order not found'});
    s.json({success:true});
  }catch(e){n(e)}
});
r.delete('/orders/:id',async(q,s,n)=>{
  try{
    const [x]=await pool.query('DELETE FROM orders WHERE id=?',[q.params.id]);
    if(!x.affectedRows)return s.status(404).json({message:'Order not found'});
    s.json({success:true});
  }catch(e){n(e)}
});
r.put('/customers/:id',async(q,s,n)=>{
  try{
    const {name,mobile,email}=q.body||{};
    if(!name||!mobile)return s.status(400).json({message:'Name and mobile are required'});
    const [dup]=await pool.query('SELECT id FROM customers WHERE mobile=? AND id<>?',[mobile,q.params.id]);
    if(dup.length)return s.status(409).json({message:'Mobile already registered to another customer'});
    const [x]=await pool.query('UPDATE customers SET name=?,mobile=?,email=? WHERE id=?',[name.trim(),mobile.trim(),email?.trim()||null,q.params.id]);
    if(!x.affectedRows)return s.status(404).json({message:'Customer not found'});
    s.json({success:true});
  }catch(e){n(e)}
});
r.delete('/customers/:id',async(q,s,n)=>{
  try{
    // Soft-delete to preserve the customer's order/payment history.
    const [x]=await pool.query('UPDATE customers SET active=0 WHERE id=?',[q.params.id]);
    if(!x.affectedRows)return s.status(404).json({message:'Customer not found'});
    s.json({success:true,deleted:true});
  }catch(e){n(e)}
});

export default r;
