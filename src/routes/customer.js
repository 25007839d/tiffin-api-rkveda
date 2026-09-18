import {Router} from 'express';import {pool} from '../db.js';import {auth} from '../auth.js';const r=Router();
r.get('/profile',auth,async(req,res,next)=>{try{const[c]=await pool.query('SELECT id,name,mobile,email,created_at FROM customers WHERE id=?',[req.user.id]);const[a]=await pool.query('SELECT * FROM addresses WHERE customer_id=? ORDER BY is_default DESC,id DESC',[req.user.id]);res.json({customer:c[0],addresses:a})}catch(e){next(e)}});
r.post('/addresses',auth,async(req,res,next)=>{try{
  // Accept both the original {x:{...}} shape and the flat shape used by
  // the current deployed frontend.
  const x=req.body?.x || req.body || {};
  const addressLine1=x.address_line1 || x.addressLine1 || x.address || '';
  const pincode=String(x.pincode || x.pin_code || '').trim();
  if(!addressLine1 || !pincode)return res.status(400).json({message:'Address and pincode are required'});

  const isDefault=Boolean(x.is_default ?? x.isDefault);
  if(isDefault)await pool.query('UPDATE addresses SET is_default=0 WHERE customer_id=?',[req.user.id]);

  const[y]=await pool.query(
    'INSERT INTO addresses(customer_id,label,address_line1,address_line2,area,city,state,pincode,landmark,is_default) VALUES(?,?,?,?,?,?,?,?,?,?)',
    [
      req.user.id,
      x.label||'Home',
      addressLine1,
      x.address_line2 || x.addressLine2 || null,
      x.area || null,
      x.city || 'Vrindavan',
      x.state || 'Uttar Pradesh',
      pincode,
      x.landmark || null,
      isDefault?1:0
    ]
  );

  const[rows]=await pool.query('SELECT * FROM addresses WHERE id=? AND customer_id=?',[y.insertId,req.user.id]);
  res.status(201).json({success:true,id:y.insertId,address:rows[0]});
}catch(e){next(e)}});
r.get('/orders',auth,async(req,res,next)=>{try{const[x]=await pool.query('SELECT o.*,p.name plan_name FROM orders o LEFT JOIN plans p ON p.id=o.plan_id WHERE o.customer_id=? ORDER BY o.created_at DESC',[req.user.id]);res.json(x)}catch(e){next(e)}});
r.get('/subscriptions',auth,async(req,res,next)=>{try{const[x]=await pool.query('SELECT s.*,p.name plan_name,p.meal_type,p.duration_days FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.customer_id=? ORDER BY s.created_at DESC',[req.user.id]);res.json(x)}catch(e){next(e)}});
export default r;
