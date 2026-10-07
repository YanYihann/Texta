const {dailyLimit} = require('./plans.cjs');
const { transaction } = require('./service.cjs');
async function reserveCredits(db,user,dateKey,cost) {
  const limit = Math.min(2147483647,dailyLimit(user));
  if (!Number.isInteger(cost) || cost<1 || cost>limit) return null;
  return transaction(db, async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
    const current = await tx.user.findUnique({where:{id:user.id}});
    if (!current || current.mergedIntoId) return null;
    await tx.usageDaily.upsert({where:{userId_dateKey:{userId:user.id,dateKey}},create:{userId:user.id,dateKey,used:0},update:{}});
    const updated=await tx.usageDaily.updateMany({where:{userId:user.id,dateKey,used:{lte:limit-cost}},data:{used:{increment:cost}}});
    if (!updated.count) return null;
    return {userId:user.id,dateKey,cost};
  });
}
async function refundCredits(db,reservation) {
  if (!reservation) return;
  await transaction(db, async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${reservation.userId} FOR UPDATE`;
    const user = await tx.user.findUnique({where:{id:reservation.userId}});
    const userId = user?.mergedIntoId || reservation.userId;
    await tx.usageDaily.updateMany({where:{userId,dateKey:reservation.dateKey,used:{gte:reservation.cost}},data:{used:{decrement:reservation.cost}}});
  });
}
module.exports={reserveCredits,refundCredits};
