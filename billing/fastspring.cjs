const crypto = require('node:crypto');
const {PRODUCTS} = require('./plans.cjs');

function amountFen(value) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(String(value))) return -1;
  const [whole, fraction=''] = String(value).split('.');
  const amount = Number(whole)*100 + Number(fraction.padEnd(2,'0'));
  return Number.isSafeInteger(amount) ? amount : -1;
}
function createFastSpring(env=process.env, request=fetch) {
  const checkoutPath=env.FASTSPRING_CHECKOUT_PATH || '';
  const secret=env.FASTSPRING_WEBHOOK_SECRET || '';
  const live=env.FASTSPRING_MODE === 'live';
  const configured=Boolean(env.FASTSPRING_USERNAME && env.FASTSPRING_PASSWORD && secret.length>=32 && /^texta\/[a-zA-Z0-9_-]+$/.test(checkoutPath));
  const enabled=configured && live && env.BILLING_ENABLED==='true';
  const productPath=id=>env['FASTSPRING_PRODUCT_'+id.toUpperCase()] || id.replaceAll('_','-');
  async function sessionFor(order,sessionLive) {
      const response=await request('https://api.fastspring.com/v2/checkouts/'+checkoutPath+'/sessions',{
        method:'POST',signal:AbortSignal.timeout(20000),
        headers:{Authorization:'Basic '+Buffer.from(env.FASTSPRING_USERNAME+':'+env.FASTSPRING_PASSWORD).toString('base64'),'Content-Type':'application/json'},
        body:JSON.stringify({locale:'zh',country:'CN',live:sessionLive,
          orderTags:{textaOrder:order.id,textaProof:order.paymentProof},
          cart:{lineItems:[{productPath:productPath(order.product),quantity:1,quantityBehavior:'LOCK',quantityDefault:1}]},paymentMethodsOrder:['ALIPAY']})
      });
      if(!response.ok) throw Error('FASTSPRING_SESSION_FAILED');
      const session=await response.json();
      const checkoutUrl=new URL(session.checkoutUrls?.webcheckoutUrl || '');
      // Fail closed before showing a checkout with a different currency, tax-inclusive total or mode.
      if(session.live!==sessionLive || session.currency!=='CNY' || amountFen(session.cart?.withTaxNetTotal)!==order.amountFen ||
        checkoutUrl.protocol!=='https:' || checkoutUrl.hostname!==(sessionLive?'texta.onfastspring.com':'texta.test.onfastspring.com') ||
        session.cart?.lineItems?.length!==1 || session.cart.lineItems[0].productPath!==productPath(order.product) ||
        session.cart.lineItems[0].quantity!==1 || session.cart.lineItems[0].quantityBehavior!=='LOCK' || !session.id || !Number.isFinite(Date.parse(session.expires))) throw Error('FASTSPRING_CHECKOUT_MISMATCH');
      return {providerSessionId:session.id,checkoutUrl:checkoutUrl.href,expiresAt:new Date(session.expires)};
  }
  return {
    enabled, configured, live, productPath,
    verify(raw,signature) {
      if (!configured || !Buffer.isBuffer(raw) || typeof signature!=='string') return false;
      const expected=crypto.createHmac('sha256',secret).update(raw).digest();
      const actual=Buffer.from(signature,'base64');
      return actual.length===expected.length && crypto.timingSafeEqual(actual,expected);
    },
    async createSession(order) {
      if (!enabled) throw Error('PAYMENTS_PAUSED');
      return sessionFor(order,true);
    },
    // Local configuration probe only. Public order routes never call this method.
    async createTestSession(order) {
      if (!configured || env.FASTSPRING_MODE!=='test' || env.BILLING_ENABLED==='true') throw Error('TEST_CHECKOUT_DISABLED');
      return sessionFor(order,false);
    }
  };
}
function verifiedPayment(order,notice,provider) {
  const item=notice.items?.[0];
  return order.provider==='fastspring' && notice.live===true && notice.completed===true && notice.payment?.type!=='test' &&
    notice.currency==='CNY' && notice.tags?.textaOrder===order.id && notice.tags?.textaProof===order.paymentProof &&
    typeof notice.id==='string' && /^[a-zA-Z0-9_-]{8,100}$/.test(notice.id) &&
    amountFen(notice.total)===order.amountFen && notice.items?.length===1 && item.quantity===1 &&
    (typeof item.product==='string'?item.product:item.product?.path)===provider.productPath(order.product) &&
    Boolean(PRODUCTS[order.product]);
}
module.exports={createFastSpring,verifiedPayment,amountFen};
