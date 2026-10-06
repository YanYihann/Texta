function bilingualAnswer() {
  return JSON.stringify({title:'A Repair Plan',paragraphs:[[
    ['The community workshop had a small ⟦1|budget⟧, so Maya offered to repair its old tables instead of buying new ones.','社区工坊的⟦1|n.|预算⟧很少，所以玛雅提出修理旧桌子，而不是买新的。'],
    ['She asked two neighbors to help and showed them a simple ⟦2|process⟧ for replacing the damaged legs.','她请两位邻居帮忙，并向他们展示了更换损坏桌腿的简单⟦2|n.|流程⟧。'],
    ['They measured each piece carefully before cutting the wood, which prevented mistakes and kept the work moving.','他们在切木头前仔细测量每一块材料，避免了失误，让工作顺利推进。'],
    ['By Saturday afternoon, all three tables were ready for the next class, and there was still enough money left to buy paint.','到周六下午，三张桌子都已修好，可以供下次课程使用，而且还剩下足够的钱买油漆。']
  ]]});
}
module.exports = { bilingualAnswer };
