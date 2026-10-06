(() => {
  const byId=id=>document.getElementById(id), dialog=byId('paymentDialog'), message=byId('payMsg');
  const base=String(window.TEXTA_API_BASE || '').replace(/\/$/,'');
  let user=null, products=[], available=false, term='monthly', selected=null, order=null, timer=0, polling=false, requestKey='', returnFocus=null, checkoutWindow=null;
  const tr=text=>window.TextaI18n?.text(text) || text;
  const storageKey=()=>`texta_pending_payment_${user?.id}`;
  const prices={plus:{monthly:'9.9',lifetime:'49.9'},pro:{monthly:'19.9',lifetime:'99.9'}};
  const money=fen=>(fen/100).toFixed(2);
  async function api(path,options={}) {
    const response=await fetch(base+path,{...options,headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('texta_auth_token') || ''}`},signal:AbortSignal.timeout(25000)});
    if(response.status===401) { location.href='./index.html'; throw Error('请重新登录。'); }
    const data=await response.json(); if(!response.ok)throw Error(data.error || '请求失败，请稍后重试。');return data;
  }
  function render() {
    byId('currentPlan').textContent=user ? tr('当前套餐：')+(user.role==='admin'?tr('管理员'):user.permanentPlan===user.plan && user.plan!=='free' ? tr('永久 ')+user.plan[0].toUpperCase()+user.plan.slice(1) : user.plan==='free'?'Free':user.plan[0].toUpperCase()+user.plan.slice(1))+(user.planExpiresAt&&user.permanentPlan!==user.plan?' · '+tr('有效期至 ')+new Date(user.planExpiresAt).toLocaleDateString():'') : tr('登录后查看你的当前套餐');
    byId('billingAvailability').textContent=tr(available?'通过 FastSpring 安全支付，到账后自动开通。':'购买暂未开放，支付服务正在准备中。');
    byId('plusPrice').textContent=prices.plus[term]; byId('proPrice').textContent=prices.pro[term];
    document.querySelectorAll('.price-period').forEach(el=>el.textContent=tr(term==='monthly'?'/ 月':'一次支付'));
    document.querySelectorAll('.plan-duration').forEach(el=>el.textContent=tr(term==='monthly'?'购买后生效一个月':'一次购买，永久有效'));
    document.querySelectorAll('[data-term]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.term===term)));
    byId('termNote').textContent=tr(term==='monthly'?'按月套餐为一次性购买，到期不会自动扣款。':'永久套餐一次性支付，无需按月续费。');
    const rank={free:0,plus:1,pro:2};
    document.querySelectorAll('[data-plan]').forEach(button=>{
      const plan=button.dataset.plan;
      const owned=user && (user.role==='admin' || rank[user.permanentPlan]>=rank[plan]);
      const lower=user && rank[user.plan]>rank[plan];
      button.disabled=!available || !user || owned || lower;
      button.textContent=tr(owned?'已拥有':lower?'当前套餐等级更高':!available?'即将开放':!user?'请先登录':user.plan===plan&&term==='monthly'?'续费套餐':'选择套餐');
    });
    window.TextaI18n?.apply();
  }
  function close() { clearTimeout(timer); dialog.close(); returnFocus?.focus(); if(order?.status==='pending')byId('resumePaymentBtn').classList.remove('hidden'); }
  function open() { if(!dialog.open){returnFocus=document.activeElement;dialog.showModal();} }
  async function showOrder(result) {
    order=result; byId('paymentConfirm').classList.add('hidden');byId('paymentQrStep').classList.remove('hidden');
    byId('paymentTitle').textContent=tr('等待支付确认');
    byId('paymentDescription').textContent=tr(products.find(item=>item.id===order.product)?.name || order.product)+` · ¥${money(order.amountFen)}`;
    byId('reopenCheckoutBtn').disabled=!order.checkoutUrl;
    byId('paymentStatus').textContent=tr('正在等待到账确认…');
    localStorage.setItem(storageKey(),order.id); byId('resumePaymentBtn').classList.add('hidden'); open(); poll();
  }
  async function poll() {
    clearTimeout(timer); if(!order || !dialog.open || polling)return; polling=true;
    try {
      const id=order.id; const data=await api('/api/billing/orders/'+encodeURIComponent(id));if(order?.id!==id)return;order=data.order;
      if(order.status==='paid') {
        checkoutWindow?.close();user=data.user;localStorage.removeItem(storageKey());localStorage.setItem('texta_plan_updated',String(Date.now()));
        byId('resumePaymentBtn').classList.add('hidden');close();render();message.classList.remove('is-error');message.textContent=tr('支付成功，套餐已生效。');return;
      }
      if(order.status==='expired') {
        byId('reopenCheckoutBtn').disabled=true;byId('paymentCountdown').textContent='';
        byId('paymentStatus').textContent=tr('订单已过期。如已支付，系统仍会核对到账结果。');
      } else {
        const seconds=Math.max(0,Math.ceil((new Date(order.expiresAt)-Date.now())/1000));
        byId('paymentCountdown').textContent=tr('订单有效期：')+`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
        byId('paymentStatus').textContent=tr('正在等待到账确认…');
      }
    } catch(error) { byId('paymentStatus').textContent=tr('暂时无法查询付款结果，将继续重试。'); }
    finally { polling=false; if(dialog.open && order?.status!=='paid')timer=setTimeout(poll,order?.status==='expired'?15000:3500); }
  }
  document.querySelectorAll('[data-term]').forEach(button=>button.addEventListener('click',()=>{term=button.dataset.term;render();}));
  document.querySelectorAll('[data-plan]').forEach(button=>button.addEventListener('click',()=>{
    if(button.disabled || !available)return;
    selected=products.find(item=>item.id===button.dataset.plan+'_'+term);if(!selected)return;
    order=null;requestKey=crypto.randomUUID();byId('paymentTitle').textContent=tr('确认套餐');
    byId('paymentDescription').textContent=`${tr(selected.name)} · ¥${money(selected.amountFen)}`;
    byId('paymentTerms').textContent=tr(term==='monthly'?'购买后生效一个月，同套餐续费顺延，到期不自动扣款。升级至 Pro 立即生效，原 Plus 剩余时间不折抵。':'一次购买，永久有效。每天积分重置，不累计。');
    byId('paymentConfirm').classList.remove('hidden');byId('paymentQrStep').classList.add('hidden');byId('paymentStatus').textContent='';open();
  }));
  byId('confirmPaymentBtn').addEventListener('click',async()=>{
    if(!selected || !available)return;const button=byId('confirmPaymentBtn');button.disabled=true;button.setAttribute('aria-busy','true');checkoutWindow=window.open('about:blank','texta_checkout','popup,width=520,height=760');if(checkoutWindow)checkoutWindow.opener=null;
    try {const data=await api('/api/billing/orders',{method:'POST',body:JSON.stringify({product:selected.id,requestKey})});if(checkoutWindow&&data.order.checkoutUrl)checkoutWindow.location.href=data.order.checkoutUrl;await showOrder(data.order);}
    catch(error){checkoutWindow?.close();byId('paymentStatus').textContent=tr(error.message);}
    finally{button.disabled=false;button.removeAttribute('aria-busy');}
  });
  byId('reopenCheckoutBtn').addEventListener('click',()=>{if(order?.checkoutUrl){checkoutWindow=window.open(order.checkoutUrl,'texta_checkout','popup,width=520,height=760');if(checkoutWindow)checkoutWindow.opener=null;}});
  byId('closePaymentBtn').addEventListener('click',close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  byId('resumePaymentBtn').addEventListener('click',async()=>{
    try {const data=await api('/api/billing/orders/'+encodeURIComponent(localStorage.getItem(storageKey())));if(data.order.status==='paid'){user=data.user;localStorage.removeItem(storageKey());byId('resumePaymentBtn').classList.add('hidden');render();message.textContent=tr('支付成功，套餐已生效。');}else await showOrder(data.order);}
    catch(error){message.textContent=tr(error.message);}
  });
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&dialog.open)poll();});
  document.addEventListener('texta:language',render);
  (async()=>{
    try {
      const catalogue=await api('/api/billing/plans');products=catalogue.products || [];available=catalogue.paymentsAvailable===true;
      products.forEach(product=>{if(prices[product.plan])prices[product.plan][product.term]=String(product.amountFen/100);});
      byId('creditNote').textContent=`积分每天北京时间 00:00 重置，不累计。每次文章生成消耗 1 积分。`;
      if(localStorage.getItem('texta_auth_token')) {user=(await api('/api/auth/me')).user;if(user.plan==='vip'){user.plan='plus';user.permanentPlan='plus';}}
      if(user&&localStorage.getItem(storageKey()))byId('resumePaymentBtn').classList.remove('hidden');
    } catch(error) {available=false;message.textContent=tr('暂时无法连接账户服务，请稍后刷新。');message.classList.add('is-error');}
    render();
  })();
})();
