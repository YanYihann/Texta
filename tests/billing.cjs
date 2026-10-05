const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {PRODUCTS,effectivePlan,dailyLimit,nextMonth,grant,purchaseError}=require('../billing/plans.cjs');
const {createFastSpring,verifiedPayment}=require('../billing/fastspring.cjs');
const {createBilling,registerBilling}=require('../billing/service.cjs');
const {reserveCredits,refundCredits}=require('../billing/credits.cjs');
const env={FASTSPRING_USERNAME:'test',FASTSPRING_PASSWORD:'test',FASTSPRING_WEBHOOK_SECRET:'x'.repeat(32),FASTSPRING_CHECKOUT_PATH:'texta/main',FASTSPRING_MODE:'live',BILLING_ENABLED:'true'};
const provider=createFastSpring(env);
const now=new Date('2026-01-31T12:00:00Z');
const free={id:'billing-test',role:'user',plan:'free',permanentPlan:'free'};
const noticeFor=order=>({id:'fastspring-order-123',live:true,completed:true,currency:'CNY',total:order.amountFen/100,payment:{type:'alipay'},tags:{textaOrder:order.id,textaProof:order.paymentProof},items:[{product:provider.productPath(order.product),quantity:1}]});

test('catalog, limits, expiry, permanent fallback and month boundary',()=>{
  assert.deepEqual(Object.values(PRODUCTS).map(p=>p.amountFen),[990,1990,4990,9990]);
  assert.equal(dailyLimit(free),10);assert.equal(dailyLimit({...free,plan:'plus'}),50);assert.equal(dailyLimit({...free,plan:'pro'}),150);
  assert.equal(dailyLimit({...free,role:'admin'}),Infinity);
  assert.equal(nextMonth(now).toISOString(),'2026-02-28T12:00:00.000Z');
  assert.equal(effectivePlan({...free,plan:'pro',permanentPlan:'plus',planExpiresAt:'2026-01-01'},now),'plus');
  assert.equal(effectivePlan({...free,plan:'plus',planExpiresAt:'2026-01-01'},now),'free');
  const monthly=grant(free,PRODUCTS.plus_monthly,now);
  assert.equal(grant({...free,...monthly},PRODUCTS.plus_monthly,now).planExpiresAt.toISOString(),'2026-03-28T12:00:00.000Z');
  assert.deepEqual(grant({...free,permanentPlan:'plus'},PRODUCTS.pro_monthly,now),{plan:'pro',planExpiresAt:nextMonth(now)});
  assert.deepEqual(grant({...free,plan:'pro',planExpiresAt:nextMonth(now)},PRODUCTS.plus_lifetime,now),{permanentPlan:'plus'});
  assert.ok(purchaseError({...free,permanentPlan:'plus'},PRODUCTS.plus_monthly,now));
});
test('paused and test configurations cannot create real checkouts',async()=>{
  assert.equal(createFastSpring({}).enabled,false);
  assert.equal(createFastSpring({...env,FASTSPRING_MODE:'test'}).enabled,false);
  const billing=createBilling({db:{},provider:createFastSpring({})});
  assert.equal((await billing.checkout('user','plus_monthly','valid-request-key')).status,503);
});
test('webhook signature uses exact bytes and rejects tampering',()=>{
  const raw=Buffer.from('{"events":[]}');const signature=crypto.createHmac('sha256',env.FASTSPRING_WEBHOOK_SECRET).update(raw).digest('base64');
  assert.equal(provider.verify(raw,signature),true);
  assert.equal(provider.verify(Buffer.from('{ "events":[]}'),signature),false);
  assert.equal(provider.verify(raw,'fake'),false);
});
test('payment binding rejects changed order, amount, currency, proof, item and test payment',()=>{
  const order={id:'TX-test',provider:'fastspring',product:'plus_monthly',amountFen:990,paymentProof:'proof'};
  const valid=noticeFor(order);assert.equal(verifiedPayment(order,valid,provider),true);
  for(const mutation of [{live:false},{completed:false},{total:0},{currency:'USD'},{payment:{type:'test'}},{tags:{...valid.tags,textaProof:'fake'}},{tags:{...valid.tags,textaOrder:'another'}},{items:[{product:'pro-monthly',quantity:1}]},{items:[{product:'plus-monthly',quantity:2}]}]) assert.equal(verifiedPayment(order,{...valid,...mutation},provider),false);
});
test('session request and returned checkout are checked before exposing payment',async()=>{
  const order={id:'TX-session',product:'plus_monthly',amountFen:990,paymentProof:'proof'};
  let body;const valid={id:'session-123',live:true,currency:'CNY',expires:'2026-12-31T00:00:00Z',cart:{withTaxNetTotal:9.9,lineItems:[{productPath:'plus-monthly',quantity:1,quantityBehavior:'LOCK'}]},checkoutUrls:{webcheckoutUrl:'https://texta.onfastspring.com/session/session-123'}};
  const p=createFastSpring(env,async(url,opts)=>{body=JSON.parse(opts.body);return {ok:true,json:async()=>valid};});
  assert.equal((await p.createSession(order)).providerSessionId,'session-123');assert.equal(body.orderTags.textaProof,'proof');assert.deepEqual(body.paymentMethodsOrder,['ALIPAY']);
  for(const mutation of [{live:false},{currency:'USD'},{cart:{...valid.cart,withTaxNetTotal:10.9}},{checkoutUrls:{webcheckoutUrl:'https://evil.example/pay'}}]) {
    const bad=createFastSpring(env,async()=>({ok:true,json:async()=>({...valid,...mutation})}));await assert.rejects(()=>bad.createSession(order));
  }
  assert.equal(body.cart.lineItems[0].quantityBehavior,'LOCK');
  const unlocked=createFastSpring(env,async()=>({ok:true,json:async()=>({...valid,cart:{...valid.cart,lineItems:[{...valid.cart.lineItems[0],quantityBehavior:'ALLOW'}]}})}));
  await assert.rejects(()=>unlocked.createSession(order));
});

test('private test probe validates Test mode and cannot open public or live purchases',async()=>{
  const order={id:'configuration-test',product:'plus_monthly',amountFen:990,paymentProof:'test-proof'};
  let body;
  const response={id:'test-session',live:false,currency:'CNY',expires:'2026-12-31T00:00:00Z',cart:{withTaxNetTotal:9.9,lineItems:[{productPath:'plus-monthly',quantity:1,quantityBehavior:'LOCK'}]},checkoutUrls:{webcheckoutUrl:'https://texta.test.onfastspring.com/session/test-session'}};
  const request=async(url,opts)=>{body=JSON.parse(opts.body);return {ok:true,json:async()=>response};};
  const testProvider=createFastSpring({...env,FASTSPRING_MODE:'test',BILLING_ENABLED:'false'},request);
  assert.equal(testProvider.enabled,false);
  await assert.rejects(()=>testProvider.createSession(order));
  assert.match((await testProvider.createTestSession(order)).checkoutUrl,/texta\.test\.onfastspring\.com/);
  assert.equal(body.live,false);
  await assert.rejects(()=>createFastSpring(env,request).createTestSession(order));
  await assert.rejects(()=>createFastSpring({...env,FASTSPRING_MODE:'test'},request).createTestSession(order));
});
test('HTTP webhook verifies raw signature and acknowledges test events without grants',async()=>{
  const express=require('express'),app=express();let writes=0;
  app.use(express.json({verify(req,res,raw){req.rawBillingBody=Buffer.from(raw);}}));
  registerBilling(app,{db:{$transaction:async()=>{writes++;throw Error('Unexpected write');}},provider,requireAuth:async()=>null,publicUser:u=>u});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  try {
    const url=`http://127.0.0.1:${server.address().port}/api/billing/fastspring/webhook`;
    const body=JSON.stringify({events:[{type:'order.completed',live:false,data:{live:false,tags:{textaOrder:'test'}}}]});
    assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body})).status,401);
    const sig=crypto.createHmac('sha256',env.FASTSPRING_WEBHOOK_SECRET).update(body).digest('base64');
    assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-FS-Signature':sig},body})).status,200);assert.equal(writes,0);
  } finally {await new Promise(r=>server.close(r));}
});
test('generation validates before debit and refunds when the model fails',async()=>{
  const fs=require('node:fs'),vm=require('node:vm');const source=fs.readFileSync('server.js','utf8');let handler,reserved=0,refunded=0;
  const context=vm.createContext({app:{post:(path,fn)=>handler=fn},console:{error:()=>{}},requireAuth:async()=>free,
    readAuthStore:async()=>({}),getUsageSnapshot:()=>({remaining:10}),normalizeGenerationQuality:()=> 'normal',
    getGenerationProfile:()=>({usageCost:1,model:'fake'}),OPENAI_API_KEY:'fake',looksLikeWordListOnlyInput:()=>true,
    splitWords:raw=>raw?[raw]:[],prisma:{},getShanghaiDateKey:()=> '2026-01-31',
    reserveCredits:async()=>{reserved++;return{cost:1};},refundCredits:async(db,r)=>{if(r)refunded++;},
    generateLexicon:async()=>{throw Error('Model unavailable');},modelTraceStorage:{run:async(store,fn)=>fn()}});
  const start=source.indexOf('app.post("/api/generate"');vm.runInContext(source.slice(start,source.indexOf('\nregisterBilling(',start)),context);
  const response={statusCode:200,status(n){this.statusCode=n;return this;},json(){return this;}};
  await handler({body:{words:''}},response);assert.equal(response.statusCode,400);assert.equal(reserved,0);
  await handler({body:{words:'apple'}},response);assert.equal(response.statusCode,500);assert.equal(reserved,1);assert.equal(refunded,1);
});
test('database settlement is atomic, idempotent and owner-scoped; credits enforce concurrency',{skip:!process.env.BILLING_TEST_DATABASE_URL},async()=>{
  const url=new URL(process.env.BILLING_TEST_DATABASE_URL);
  assert.match(url.searchParams.get('schema')||'',/^texta_billing_test_[a-z0-9_]+$/);
  const {PrismaClient}=require('@prisma/client');const db=new PrismaClient({datasources:{db:{url:url.href}}});
  try {
    await db.user.create({data:{...free,email:'test@example.invalid',name:'Test',passwordHash:'unused',createdAt:now.toISOString()}});
    const order=await db.paymentOrder.create({data:{id:'TX-integration',userId:free.id,product:'plus_monthly',amountFen:990,provider:'fastspring',paymentProof:'proof',requestKey:'integration-request',expiresAt:nextMonth(now)}});
    const b=createBilling({db,provider,now:()=>now});const notice=noticeFor(order);
    await Promise.all([b.settle(notice),b.settle(notice)]);
    assert.equal((await db.user.findUnique({where:{id:free.id}})).planExpiresAt.toISOString(),nextMonth(now).toISOString());
    assert.equal(await b.status('other-user',order.id),null);
    assert.equal((await b.status(free.id,order.id)).status,'paid');
    const second=await db.paymentOrder.create({data:{id:'TX-duplicate-trade',userId:free.id,product:'pro_monthly',amountFen:1990,provider:'fastspring',paymentProof:'second',requestKey:'second-request',expiresAt:nextMonth(now)}});
    await assert.rejects(()=>b.settle({...noticeFor(second),id:notice.id}));
    assert.equal((await db.user.findUnique({where:{id:free.id}})).plan,'plus');
    const results=await Promise.all(Array.from({length:20},()=>reserveCredits(db,free,'2026-01-31',1)));
    assert.equal(results.filter(Boolean).length,10);assert.equal(await reserveCredits(db,free,'2026-02-01',11),null);
    await refundCredits(db,results.find(Boolean));assert.ok(await reserveCredits(db,free,'2026-01-31',1));
    const old=await db.user.create({data:{...free,id:'old-vip',email:'old@example.invalid',name:'Old',passwordHash:'unused',createdAt:now.toISOString(),plan:'vip'}});
    await db.user.updateMany({where:{plan:'vip'},data:{plan:'plus',permanentPlan:'plus',planExpiresAt:null}});
    assert.equal((await db.user.findUnique({where:{id:old.id}})).permanentPlan,'plus');
    assert.equal((await db.user.updateMany({where:{plan:'vip'},data:{plan:'plus',permanentPlan:'plus'}})).count,0);
  } finally {await db.$disconnect();}
});
