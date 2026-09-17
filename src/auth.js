import jwt from 'jsonwebtoken';
export const token=(u)=>jwt.sign(u,process.env.JWT_SECRET,{expiresIn:'7d'});
export function auth(req,res,next){try{
 const t=(req.headers.authorization||'').replace('Bearer ',''); if(!t) return res.status(401).json({message:'Authentication required'});
 req.user=jwt.verify(t,process.env.JWT_SECRET); next();
}catch{return res.status(401).json({message:'Invalid or expired token'})}}
export function admin(req,res,next){if(!['admin','super_admin'].includes(req.user?.role))return res.status(403).json({message:'Admin access required'});next()}
