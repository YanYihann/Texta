const PRODUCTS = Object.freeze({
  plus_monthly: {id:'plus_monthly', plan:'plus', term:'monthly', name:'Plus 月度套餐', amountFen:990, dailyCredits:50},
  pro_monthly: {id:'pro_monthly', plan:'pro', term:'monthly', name:'Pro 月度套餐', amountFen:1990, dailyCredits:150},
  plus_lifetime: {id:'plus_lifetime', plan:'plus', term:'lifetime', name:'永久 Plus', amountFen:4990, dailyCredits:50},
  pro_lifetime: {id:'pro_lifetime', plan:'pro', term:'lifetime', name:'永久 Pro', amountFen:9990, dailyCredits:150}
});
const rank = {free:0, plus:1, pro:2};
function normalizePlan(plan) { return plan === 'vip' ? 'plus' : Object.hasOwn(rank, plan) ? plan : 'free'; }
function effectivePlan(user, now = new Date()) {
  const permanent = normalizePlan(user?.permanentPlan);
  let current = normalizePlan(user?.plan);
  if (user?.planExpiresAt && new Date(user.planExpiresAt) <= now) current = 'free';
  return rank[permanent] > rank[current] ? permanent : current;
}
function dailyLimit(user, now = new Date()) {
  if (user?.role === 'admin') return Infinity;
  return {free:10, plus:50, pro:150}[effectivePlan(user, now)];
}
function nextMonth(date) {
  const next = new Date(date), day = next.getUTCDate();
  next.setUTCDate(1); next.setUTCMonth(next.getUTCMonth() + 1);
  const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth()+1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day,last)); return next;
}
function purchaseError(user, product, now = new Date()) {
  if (user.role === 'admin') return '管理员无需购买套餐。';
  if (rank[normalizePlan(user.permanentPlan)] >= rank[product.plan]) return '你已拥有该等级或更高等级的永久套餐。';
  if (rank[effectivePlan(user,now)] > rank[product.plan]) return '当前套餐等级更高，请在到期后选择此套餐。';
  return '';
}
function grant(user, product, now = new Date()) {
  const permanent = normalizePlan(user.permanentPlan);
  if (product.term === 'lifetime') {
    const permanentPlan = rank[product.plan] > rank[permanent] ? product.plan : permanent;
    if (rank[effectivePlan(user,now)] > rank[permanentPlan]) return {permanentPlan};
    return {permanentPlan, plan:permanentPlan, planExpiresAt:null};
  }
  // A late payment can never erase an already granted permanent entitlement.
  if (rank[permanent] >= rank[product.plan]) return {};
  const current = effectivePlan(user,now);
  if (rank[current] > rank[product.plan]) throw new Error('PLAN_CONFLICT');
  const expiry = user.plan === product.plan && user.planExpiresAt && new Date(user.planExpiresAt) > now ? new Date(user.planExpiresAt) : now;
  return {plan:product.plan, planExpiresAt:nextMonth(expiry)};
}
module.exports = {PRODUCTS, normalizePlan, effectivePlan, dailyLimit, nextMonth, purchaseError, grant};
