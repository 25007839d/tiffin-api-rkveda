import {Router} from 'express';import {pool} from '../db.js';const r=Router();
r.get('/',async(req,res,next)=>{try{const[x]=await pool.query('SELECT * FROM plans WHERE active=1 ORDER BY sort_order,id');res.json(x)}catch(e){next(e)}});
export default r;
