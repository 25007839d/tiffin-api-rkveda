import {Router} from 'express';
import {pool} from '../db.js';
import {auth} from '../auth.js';

const r=Router();

const num=()=>`RKV${Date.now().toString().slice(-8)}${Math.floor(Math.random()*90+10)}`;
const sub=()=>`RKVS${Date.now().toString().slice(-9)}`;

r.post('/',auth,async(req,res,next)=>{
  const c=await pool.getConnection();
  try{
    const body=req.body||{};

    const plan_id=body.plan_id ?? body.planId;
    const address_id=body.address_id ?? body.addressId;
    const order_type=body.order_type ?? body.orderType ?? 'one_time';
    const meal_type=body.meal_type ?? body.mealType;
    const quantity=Math.max(1,Number(body.quantity ?? 1));
    const service_date=body.service_date ?? body.serviceDate;
    const start_date=body.start_date ?? body.startDate;
    const end_date=body.end_date ?? body.endDate;
    const notes=body.notes;
    const payment_method=String(body.payment_method ?? body.paymentMethod ?? 'online').toLowerCase();

    const[p]=await c.query('SELECT * FROM plans WHERE id=? AND active=1',[plan_id]);
    if(!p.length)return res.status(400).json({success:false,message:'Invalid plan'});

    const[a]=await c.query(
      'SELECT id FROM addresses WHERE id=? AND customer_id=?',
      [address_id,req.user.id]
    );
    if(!a.length)return res.status(400).json({success:false,message:'Invalid address'});

    const plan=p[0];
    const total=Number(plan.price)*quantity;
    const start=start_date||service_date||new Date().toISOString().slice(0,10);
    const end=end_date||(plan.duration_days===1
      ? start
      : new Date(Date.parse(start)+(plan.duration_days-1)*86400000).toISOString().slice(0,10));

    await c.beginTransaction();

    const[x]=await c.query(
      `INSERT INTO orders(
        order_number,customer_id,address_id,plan_id,order_type,meal_type,quantity,
        service_date,start_date,end_date,subtotal,delivery_charge,total_amount,notes
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        num(),req.user.id,address_id,plan.id,order_type,
        meal_type||plan.meal_type,quantity,start,start,end,total,0,total,notes||null
      ]
    );

    if(order_type==='subscription'){
      const meals=plan.duration_days*(plan.meal_type==='both'?2:1);
      await c.query(
        `INSERT INTO subscriptions(
          subscription_number,customer_id,plan_id,order_id,start_date,end_date,status,meals_remaining
        ) VALUES(?,?,?,?,?,?, 'pending',?)`,
        [sub(),req.user.id,plan.id,x.insertId,start,end,meals]
      );
    }

    const isCod=payment_method==='cod' || payment_method==='cash_on_delivery';
    if(isCod){
      await c.query(
        `UPDATE orders SET order_status='confirmed',payment_status='pending' WHERE id=?`,
        [x.insertId]
      );
      if(order_type==='subscription'){
        await c.query(
          `UPDATE subscriptions SET status='active' WHERE order_id=? AND status='pending'`,
          [x.insertId]
        );
      }
    }

    const[created]=await c.query(
      `SELECT id,order_number,total_amount,payment_status,order_status
       FROM orders WHERE id=?`,
      [x.insertId]
    );

    await c.commit();

    const order=created[0];
    res.status(201).json({
      success:true,
      orderId:order.id,
      order_id:order.id,
      amount:Number(order.total_amount),
      total_amount:Number(order.total_amount),
      currency:'INR',
      payment_method:isCod?'cod':'online',
      order_status:order.order_status,
      payment_status:order.payment_status,
      order
    });
  }catch(e){
    try{await c.rollback()}catch{}
    next(e);
  }finally{
    c.release();
  }
});

export default r;
