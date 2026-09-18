import {Router} from 'express';
import crypto from 'crypto';
import {pool} from '../db.js';
import {auth} from '../auth.js';

const r=Router();

const cashfreeBaseUrl=()=>(
  String(process.env.CASHFREE_ENV||'sandbox').toLowerCase()==='production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg'
);

const cashfreeConfigured=()=>Boolean(
  process.env.CASHFREE_CLIENT_ID && process.env.CASHFREE_CLIENT_SECRET
);

const cashfreeHeaders=(extra={})=>({
  'x-client-id':process.env.CASHFREE_CLIENT_ID,
  'x-client-secret':process.env.CASHFREE_CLIENT_SECRET,
  'x-api-version':process.env.CASHFREE_API_VERSION||'2025-01-01',
  'accept':'application/json',
  'content-type':'application/json',
  ...extra
});

async function cashfreeRequest(path, options={}){
  const response=await fetch(`${cashfreeBaseUrl()}${path}`,{
    ...options,
    headers:cashfreeHeaders(options.headers||{})
  });
  const text=await response.text();
  let data={};
  try{data=text?JSON.parse(text):{};}catch{data={raw:text};}
  if(!response.ok){
    const error=new Error(data?.message||data?.error?.message||`Cashfree API error (${response.status})`);
    error.status=response.status;
    error.cashfree=data;
    throw error;
  }
  return data;
}

function normalizeMobile(value){
  const raw=String(value||'').trim();
  const digits=raw.replace(/\D/g,'');
  if(digits.length===10)return digits;
  if(digits.length===12 && digits.startsWith('91'))return digits.slice(2);
  return '';
}

function makeCashfreeOrderId(internalOrderId){
  // Cashfree order_id: alphanumeric, '_' and '-' only, max 45 chars.
  return `RKV_${internalOrderId}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`.slice(0,45);
}

async function markCashfreePaymentPaid(connection, paymentRow, remotePayment=null){
  await connection.query(
    `UPDATE payments
     SET gateway_payment_id=COALESCE(?,gateway_payment_id),
         method=COALESCE(?,method),
         status='captured',
         raw_response=?,
         paid_at=COALESCE(paid_at,NOW())
     WHERE id=?`,
    [
      remotePayment?.cf_payment_id ? String(remotePayment.cf_payment_id) : null,
      remotePayment?.payment_method || remotePayment?.payment_group || null,
      JSON.stringify(remotePayment||{}),
      paymentRow.id
    ]
  );
  await connection.query(
    `UPDATE orders SET payment_status='paid',order_status='confirmed'
     WHERE id=? AND payment_status<>'refunded'`,
    [paymentRow.order_id]
  );
  await connection.query(
    `UPDATE subscriptions SET status='active' WHERE order_id=? AND status='pending'`,
    [paymentRow.order_id]
  );
}

async function syncCashfreeOrder(internalOrderId, customerId){
  const [rows]=await pool.query(
    `SELECT p.*,o.order_number,o.total_amount
     FROM payments p JOIN orders o ON o.id=p.order_id
     WHERE p.order_id=? AND p.customer_id=? AND p.gateway='cashfree'
     ORDER BY p.id DESC LIMIT 1`,
    [internalOrderId,customerId]
  );
  if(!rows.length)return null;
  const payment=rows[0];
  if(!payment.gateway_order_id)return payment;

  const remote=await cashfreeRequest(`/orders/${encodeURIComponent(payment.gateway_order_id)}`);
  const [remotePayments]=await pool.query(
    `SELECT id FROM payments WHERE id=?`,
    [payment.id]
  );
  if(!remotePayments.length)return null;

  if(remote.order_status==='PAID'){
    const paymentList=await cashfreeRequest(
      `/orders/${encodeURIComponent(payment.gateway_order_id)}/payments`
    );
    const latest=Array.isArray(paymentList)
      ? paymentList.find(x=>String(x.payment_status||'').toUpperCase()==='SUCCESS') || paymentList[0]
      : null;
    await markCashfreePaymentPaid(pool,payment,latest||remote);
  }else if(['EXPIRED','TERMINATED'].includes(remote.order_status)){
    await pool.query(
      `UPDATE payments SET status='failed',raw_response=? WHERE id=? AND status NOT IN ('captured','refunded')`,
      [JSON.stringify(remote),payment.id]
    );
  }

  return {
    ...payment,
    cashfree_order_status:remote.order_status,
    payment_session_id:remote.payment_session_id||null
  };
}

// Creates the payment order for the currently configured gateway.
// Set PAYMENT_GATEWAY=cashfree for RKVeda Tiffin.
r.post('/create',auth,async(req,res,next)=>{
  try{
    const [rows]=await pool.query(
      `SELECT o.*,c.name customer_name,c.mobile customer_mobile,c.email customer_email
       FROM orders o JOIN customers c ON c.id=o.customer_id
       WHERE o.id=? AND o.customer_id=?`,
      [req.body.order_id,req.user.id]
    );
    if(!rows.length)return res.status(404).json({message:'Order not found'});
    const o=rows[0];

    if(o.payment_status==='paid'){
      return res.status(400).json({message:'Order is already paid'});
    }

    const gateway=String(process.env.PAYMENT_GATEWAY||'cashfree').toLowerCase();

    if(gateway==='cashfree'){
      if(!cashfreeConfigured()){
        return res.status(503).json({message:'Cashfree is not configured'});
      }

      const mobile=normalizeMobile(o.customer_mobile);
      if(!mobile){
        return res.status(400).json({message:'A valid 10-digit customer mobile number is required for Cashfree'});
      }

      // Reuse an active Cashfree payment order when possible.
      const [existing]=await pool.query(
        `SELECT * FROM payments
         WHERE order_id=? AND customer_id=? AND gateway='cashfree'
           AND status IN ('created','authorized')
         ORDER BY id DESC LIMIT 1`,
        [o.id,req.user.id]
      );

      if(existing.length && existing[0].gateway_order_id){
        try{
          const remote=await cashfreeRequest(
            `/orders/${encodeURIComponent(existing[0].gateway_order_id)}`
          );
          if(['ACTIVE','PAID'].includes(remote.order_status) && remote.payment_session_id){
            return res.json({
              gateway:'cashfree',
              key_id:process.env.CASHFREE_CLIENT_ID,
              cashfree_order_id:existing[0].gateway_order_id,
              payment_session_id:remote.payment_session_id,
              amount:Math.round(Number(o.total_amount)*100),
              order_amount:Number(o.total_amount),
              currency:'INR',
              order_number:o.order_number,
              order_status:remote.order_status
            });
          }
        }catch(e){
          console.warn('Existing Cashfree order could not be reused:',e.message);
        }
      }

      const cfOrderId=makeCashfreeOrderId(o.id);
      const frontend=String(process.env.FRONTEND_URL||'https://tiffin.rkveda.in').split(',')[0].trim();
      const returnUrl=process.env.CASHFREE_RETURN_URL
        || `${frontend.replace(/\/$/,'')}/payment/callback?order_id={order_id}`;
      const notifyUrl=process.env.CASHFREE_NOTIFY_URL
        || `${String(process.env.API_PUBLIC_URL||'https://tiffin-api.rkveda.in').replace(/\/$/,'')}/api/payments/cashfree/webhook`;

      const payload={
        order_id:cfOrderId,
        order_amount:Number(Number(o.total_amount).toFixed(2)),
        order_currency:'INR',
        customer_details:{
          customer_id:`cust_${o.customer_id}`,
          customer_name:o.customer_name,
          customer_phone:mobile,
          ...(o.customer_email?{customer_email:o.customer_email}: {})
        },
        order_meta:{
          return_url:returnUrl,
          notify_url:notifyUrl
        },
        order_note:`RKVeda Tiffin ${o.order_number}`,
        order_tags:{
          rkveda_order_id:String(o.id),
          rkveda_order_number:o.order_number
        }
      };

      const cf=await cashfreeRequest('/orders',{
        method:'POST',
        headers:{
          'x-request-id':crypto.randomUUID(),
          'x-idempotency-key':crypto.randomUUID()
        },
        body:JSON.stringify(payload)
      });

      await pool.query(
        `INSERT INTO payments(order_id,customer_id,gateway,gateway_order_id,amount,currency,status,raw_response)
         VALUES(?,?,?,?,?,?,?,?)`,
        [o.id,req.user.id,'cashfree',cf.order_id,o.total_amount,'INR','created',JSON.stringify(cf)]
      );

      return res.json({
        gateway:'cashfree',
        key_id:process.env.CASHFREE_CLIENT_ID,
        cashfree_order_id:cf.order_id,
        payment_session_id:cf.payment_session_id,
        amount:Math.round(Number(o.total_amount)*100),
        order_amount:Number(o.total_amount),
        currency:cf.order_currency||'INR',
        order_number:o.order_number,
        order_status:cf.order_status||'ACTIVE'
      });
    }

    return res.status(503).json({message:`Unsupported payment gateway: ${gateway}`});
  }catch(e){next(e)}
});

// Verify/sync Cashfree payment from the server. Never trust the browser callback alone.
r.post('/verify',auth,async(req,res,next)=>{
  try{
    const orderId=req.body.order_id;
    const [orders]=await pool.query(
      `SELECT * FROM orders WHERE id=? AND customer_id=?`,
      [orderId,req.user.id]
    );
    if(!orders.length)return res.status(404).json({message:'Order not found'});

    const payment=await syncCashfreeOrder(orderId,req.user.id);
    if(!payment)return res.status(404).json({message:'Cashfree payment order not found'});

    const [updated]=await pool.query(
      `SELECT payment_status,order_status,total_amount FROM orders WHERE id=?`,
      [orderId]
    );
    return res.json({
      success:updated[0]?.payment_status==='paid',
      gateway:'cashfree',
      payment_status:updated[0]?.payment_status,
      order_status:updated[0]?.order_status,
      amount:updated[0]?.total_amount,
      cashfree_order_status:payment.cashfree_order_status||null
    });
  }catch(e){next(e)}
});

r.get('/cashfree/status/:orderId',auth,async(req,res,next)=>{
  try{
    const [orders]=await pool.query(
      `SELECT id,payment_status,order_status,total_amount
       FROM orders WHERE id=? AND customer_id=?`,
      [req.params.orderId,req.user.id]
    );
    if(!orders.length)return res.status(404).json({message:'Order not found'});
    const payment=await syncCashfreeOrder(req.params.orderId,req.user.id);
    const [updated]=await pool.query(
      `SELECT payment_status,order_status,total_amount FROM orders WHERE id=?`,
      [req.params.orderId]
    );
    res.json({
      gateway:'cashfree',
      success:updated[0]?.payment_status==='paid',
      payment_status:updated[0]?.payment_status,
      order_status:updated[0]?.order_status,
      amount:updated[0]?.total_amount,
      cashfree_order_status:payment?.cashfree_order_status||null
    });
  }catch(e){next(e)}
});

function verifyCashfreeWebhook(rawBody,timestamp,signature){
  if(!process.env.CASHFREE_WEBHOOK_SECRET || !timestamp || !signature)return false;
  const tsNumber=Number(timestamp);
  if(Number.isFinite(tsNumber)){
    const tsMs=tsNumber<1e12?tsNumber*1000:tsNumber;
    const tolerance=Number(process.env.CASHFREE_WEBHOOK_TOLERANCE_SECONDS||300)*1000;
    if(Math.abs(Date.now()-tsMs)>tolerance)return false;
  }
  const expected=crypto.createHmac('sha256',process.env.CASHFREE_WEBHOOK_SECRET)
    .update(`${timestamp}${rawBody}`)
    .digest('base64');
  const a=Buffer.from(expected);
  const b=Buffer.from(String(signature));
  return a.length===b.length && crypto.timingSafeEqual(a,b);
}

// Cashfree webhook. Cashfree requires HMAC-SHA256(timestamp + rawBody), Base64.
r.post('/cashfree/webhook',async(req,res)=>{
  try{
    const rawBody=Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : JSON.stringify(req.body||{});
    const timestamp=req.headers['x-webhook-timestamp'];
    const signature=req.headers['x-webhook-signature'];

    if(!verifyCashfreeWebhook(rawBody,timestamp,signature)){
      return res.status(400).json({message:'Invalid Cashfree webhook signature'});
    }

    const body=JSON.parse(rawBody);
    const cfOrderId=
      body?.data?.order?.order_id ||
      body?.data?.order_details?.order_id ||
      body?.order_id;

    if(!cfOrderId)return res.json({received:true,processed:false});

    const [payments]=await pool.query(
      `SELECT p.*,o.order_number
       FROM payments p JOIN orders o ON o.id=p.order_id
       WHERE p.gateway='cashfree' AND p.gateway_order_id=?
       LIMIT 1`,
      [cfOrderId]
    );
    if(!payments.length)return res.json({received:true,processed:false});

    const payment=payments[0];
    const eventType=String(body?.type||body?.event||'').toUpperCase();
    const remotePayment=body?.data?.payment||body?.data?.payment_details||null;
    const paymentStatus=String(
      remotePayment?.payment_status ||
      body?.data?.payment_status ||
      ''
    ).toUpperCase();

    if(eventType.includes('SUCCESS') || paymentStatus==='SUCCESS'){
      await markCashfreePaymentPaid(pool,payment,remotePayment);
    }else if(eventType.includes('FAILED') || ['FAILED','USER_DROPPED'].includes(paymentStatus)){
      await pool.query(
        `UPDATE payments SET status='failed',raw_response=? WHERE id=? AND status<>'captured'`,
        [JSON.stringify(body),payment.id]
      );
      await pool.query(
        `UPDATE orders SET payment_status='failed' WHERE id=? AND payment_status<>'paid'`,
        [payment.order_id]
      );
    }

    res.json({received:true,processed:true});
  }catch(e){
    console.error('Cashfree webhook error:',e);
    res.status(500).json({message:'Webhook processing failed'});
  }
});

export default r;
