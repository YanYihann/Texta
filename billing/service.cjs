const crypto = require('node:crypto');
const {verifiedPayment,amountFen}=require('./fastspring.cjs');
const {PRODUCTS, purchaseError, grant} = require('./plans.cjs');

async function transaction(db, work) {
  for (let attempt=0; attempt<4; attempt++) {
    try { return await db.$transaction(work,{isolationLevel:'Serializable'}); }
    catch(error) { if(error.code !== 'P2034' || attempt===3) throw error; }
  }
}
function createBilling({db, provider, now=()=>new Date()}) {
  async function settle(notice) {
    return transaction(db,async tx => {
      const order = await tx.paymentOrder.findUnique({where:{id:String(notice.tags?.textaOrder || '')}});
      if (!order || !verifiedPayment(order,notice,provider)) throw new Error('INVALID_PAYMENT');
      if (order.status === 'paid') {
        if (order.tradeNo !== notice.id) throw new Error('TRADE_MISMATCH');
        return order;
      }
      const user = await tx.user.findUnique({where:{id:order.userId}});
      if (!user) throw new Error('USER_NOT_FOUND');
      const product = PRODUCTS[order.product];
      if (!product || product.amountFen !== order.amountFen) throw new Error('PRODUCT_MISMATCH');
      await tx.user.update({where:{id:user.id},data:grant(user,product,now())});
      return tx.paymentOrder.update({where:{id:order.id},data:{status:'paid',tradeNo:notice.id,paidAt:now()}});
    });
  }
  async function serialize(order) {
    return {id:order.id,product:order.product,amountFen:order.amountFen,status:order.status,expiresAt:order.expiresAt,paidAt:order.paidAt,checkoutUrl:order.status==='pending' && new Date(order.expiresAt)>now()?order.checkoutUrl:null};
  }
  async function checkout(userId, productId, requestKey) {
    if (!provider.enabled) return {status:503,error:'购买暂未开放，支付服务正在准备中。'};
    const product = PRODUCTS[productId];
    if (!product || !/^[a-zA-Z0-9_-]{16,80}$/.test(requestKey || '')) return {status:400,error:'套餐或请求编号无效。'};
    const selected = await transaction(db,async tx => {
      const duplicate = await tx.paymentOrder.findUnique({where:{userId_requestKey:{userId,requestKey}}});
      if (duplicate) {
        if (duplicate.product !== productId) return {error:'请求编号已用于其他套餐。'};
        return {order:duplicate};
      }
      const user = await tx.user.findUnique({where:{id:userId}});
      const error = user ? purchaseError(user,product,now()) : '账户不存在。';
      if (error) return {error};
      const active = await tx.paymentOrder.findFirst({where:{userId,status:{in:['pending','creating','checkout_failed']},expiresAt:{gt:now()}},orderBy:{createdAt:'desc'}});
      if (active) return active.product === productId ? {order:active} : {error:'已有待支付订单，请等待其过期后更换套餐。'};
      const order = await tx.paymentOrder.create({data:{id:`TX${Date.now()}${crypto.randomBytes(8).toString('hex')}`,userId,product:productId,amountFen:product.amountFen,provider:'fastspring',paymentProof:crypto.randomBytes(32).toString('hex'),requestKey,expiresAt:new Date(now().getTime()+24*60*60*1000)}});
      return {order};
    });
    if (selected.error) return {status:409,error:selected.error};
    let order = selected.order;
    if (order.status !== 'pending' || new Date(order.expiresAt)<=now()) return {status:409,error:'该订单已结束，请重新选择套餐。'};
    if (!order.checkoutUrl) {
      const claimed=await db.paymentOrder.updateMany({where:{id:order.id,status:'pending',checkoutUrl:null},data:{status:'creating'}});
      if(!claimed.count) return {status:409,error:'支付窗口正在准备，请稍后重试。'};
      try {
        const session = await provider.createSession(order);
        await db.paymentOrder.updateMany({where:{id:order.id,status:'creating'},data:{...session,status:'pending'}});
        order=await db.paymentOrder.findUnique({where:{id:order.id}});
      } catch(error) {
        // An upstream timeout may still have created a session. Do not create a second chargeable session.
        await db.paymentOrder.updateMany({where:{id:order.id,status:'creating'},data:{status:'checkout_failed'}});
        throw error;
      }
    }
    return {order:await serialize(order,true)};
  }
  async function status(userId, id) {
    let order = await db.paymentOrder.findFirst({where:{id,userId}});
    if (!order) return null;
    if (order.status === 'pending' && new Date(order.expiresAt)<=now()) {
      await db.paymentOrder.updateMany({where:{id,status:'pending'},data:{status:'expired'}});
      order = await db.paymentOrder.findUnique({where:{id}});
    }
    return serialize(order,true);
  }
  return {settle,checkout,status};
}
function registerBilling(app,{db,provider,requireAuth,publicUser}) {
  const billing = createBilling({db,provider});
  app.get('/api/billing/plans',async(req,res)=>{
    res.json({products:Object.values(PRODUCTS),paymentsAvailable:Boolean(provider.enabled),currency:'CNY',dailyReset:'Asia/Shanghai',advancedUsageCost:Math.max(1,Number(process.env.ADVANCED_USAGE_COST || 5))});
  });
  app.post('/api/billing/orders',async(req,res)=>{
    try {
      const user=await requireAuth(req,res); if(!user)return;
      const result=await billing.checkout(user.id,req.body.product,req.body.requestKey);
      res.status(result.status || 200).json(result);
    } catch(error) {console.error('[billing] checkout failed',error.code || error.name);res.status(502).json({error:'支付订单创建失败，请重试。'});}
  });
  app.get('/api/billing/orders/:id',async(req,res)=>{
    try {
      const user=await requireAuth(req,res); if(!user)return;
      const order=await billing.status(user.id,req.params.id);
      if(!order)return res.status(404).json({error:'订单不存在。'});
      res.set('Cache-Control','no-store');
      res.json({order,user:publicUser(await db.user.findUnique({where:{id:user.id}}))});
    } catch(error) {res.status(503).json({error:'暂时无法查询付款结果，将继续重试。'});}
  });
  app.post('/api/billing/fastspring/webhook',async(req,res)=>{
    try {
      if (!provider.verify(req.rawBillingBody,req.get('X-FS-Signature'))) return res.status(401).json({error:'Invalid signature'});
      if (!Array.isArray(req.body?.events) || req.body.events.length>100) return res.status(400).json({error:'Invalid events'});
      for (const event of req.body.events) {
        // Test purchases never grant production entitlements, even when the checkout switch is off.
        if (event.live!==true || event.data?.live!==true || event.type!=='order.completed') continue;
        if (!event.data.tags?.textaOrder) continue;
        await billing.settle(event.data);
      }
      res.json({ok:true});
    } catch(error) {console.error('[billing] callback failed',error.code || error.message);res.status(503).json({error:'Payment reconciliation pending'});}
  });
  return billing;
}
module.exports={createBilling,registerBilling,transaction,verifiedPayment,amountFen};
