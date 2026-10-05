const {dailyLimit} = require('./plans.cjs');
async function reserveCredits(db,user,dateKey,cost) {
  const limit = Math.min(2147483647,dailyLimit(user));
  if (!Number.isInteger(cost) || cost<1 || cost>limit) return null;
  // Prisma qualifies the schema explicitly, including behind transaction-pooling proxies.
  try {
    await db.usageDaily.upsert({where:{userId_dateKey:{userId:user.id,dateKey}},create:{userId:user.id,dateKey,used:0},update:{}});
  } catch(error) { if(error.code!=='P2002') throw error; }
  const updated=await db.usageDaily.updateMany({where:{userId:user.id,dateKey,used:{lte:limit-cost}},data:{used:{increment:cost}}});
  if (!updated.count) return null;
  return {userId:user.id,dateKey,cost};
}
async function refundCredits(db,reservation) {
  if (!reservation) return;
  await db.usageDaily.updateMany({where:{userId:reservation.userId,dateKey:reservation.dateKey,used:{gte:reservation.cost}},data:{used:{decrement:reservation.cost}}});
}
module.exports={reserveCredits,refundCredits};
