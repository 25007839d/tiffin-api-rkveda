import {Router} from 'express';import {pool} from '../db.js';const r=Router();
r.get('/weekly',async(req,res,next)=>{try{const[x]=await pool.query('SELECT * FROM menu_days WHERE active=1 ORDER BY day_of_week');res.json(x)}catch(e){next(e)}});
r.get('/today',async(req,res,next)=>{try{const d=new Date().getDay()||7;const[x]=await pool.query('SELECT * FROM menu_days WHERE day_of_week=? AND active=1',[d]);res.json(x[0]||null)}catch(e){next(e)}});
export default r;
