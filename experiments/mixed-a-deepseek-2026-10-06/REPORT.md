# 修改后的 A 方案：DeepSeek V3.2 实测与替换候选

日期：2026-10-06。请求模型：deepseek-v3.2。通过项目原有 302.ai Chat Completions 适配器实测，temperature=0.4。

**发布状态：本地候选代码已实现，未提交、推送或部署。功能与格式检查通过；随机难词组的故事语义质量仍未达到用户要求，不能认定“完全没问题”。**

## 当前实现

一次模型调用返回简短 storyPlan、选定词义 vocabulary、标题、带词义标记的中文故事。原词、词性、中文词义共同出现在标记中，例如 ⟦budget|n.|预算⟧。代码将整个标记还原为输入原词，同时提取语境词义。没有英文草稿、翻译流程，也没有独立词库、用法规划、逐块生成或语义复审请求。

目标词优先一次，最多两次且词义一致。检查全词覆盖、合法词性、标记词义与已选义项一致、额外英文、篇幅及中文连接长度。可明确判定的闭合符号缺失和紧邻释义重复由代码修复；相邻英文词之间补空格。不猜测替换正文中的中文，不追加补词句。不合格时最多重新生成一次，仍失败则报错并退还积分。

混合请求关闭传输层自动重试，每次请求超时上限为30秒（超过48词为60秒），并受原OPENAI_TIMEOUT_MS更短配置约束。两次内容请求的上限分别约60秒或120秒；正常耗时见实测。

取消高级生成档位，前后端均将旧 advanced 请求归为 normal，每次生成扣1积分。保留初级/中级/高级难度与双语文章模式。混合文章不再自动预取所有词的详细词典，也不再向模型请求例句中文译文；例句通过语境词义本地还原，详细词典在点击词汇时加载并保留原语境词义。

## 最终版本的真实 API 测试

| 词表 | 输入数 | 生成请求数 | 最终覆盖 | 最终中文汉字 | 耗时秒 | 输入tokens | 输出tokens | 合计tokens |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| theme-6 | 6 | 1 | 6/6 | 50 | 2.45 | 615 | 305 | 920 |
| mixed-12 | 12 | 1 | 12/12 | 30 | 2.61 | 632 | 393 | 1025 |
| long-24 | 24 | 1 | 24/24 | 75 | 4.19 | 668 | 876 | 1544 |
| mixed-12-repeat | 12 | 1 | 12/12 | 39 | 3.00 | 632 | 405 | 1037 |
| long-25 | 25 | 1 | 25/25 | 66 | 3.87 | 671 | 893 | 1564 |
| phrases | 6 | 1 | 6/6 | 32 | 1.74 | 615 | 234 | 849 |
| single | 1 | 2 | 1/1 | 51 | 3.14 | 1238 | 173 | 1411 |
| new-school-12 | 12 | 1 | 12/12 | 40 | 2.34 | 629 | 391 | 1020 |
| new-random-15 | 15 | 2 | 15/15 | 72 | 6.60 | 1309 | 1113 | 2422 |
| long-48-quick | 48 | 1 | 48/48 | 151 | 6.10 | 734 | 1670 | 2404 |
| limit-120 | 120 | 1 | 120/120 | 245 | 12.03 | 911 | 3874 | 4785 |

11组均最终通过机械检查，9组首次通过。覆盖使用项目findMissingWords检查，最终所有文本又由当前版本解析器复核。

耗时包含本机网络与服务端等待，tokens取真实API usage，包含同一次响应里的词义及简短事件计划。与此前Codex测试不同，这次没有Codex基础上下文开销；不能跨模型或跨运行方式直接计算提速倍数。每组只做一次完整尝试（最多含一次自动重生成），不代表长期成功率或线上SLA。

本机直连302.ai失败，测试进程通过Windows已有127.0.0.1:7890代理连接；没有改用户全局配置。直连失败保存在network-direct-results.json；提示词迭代样例与失败结果保存在initial及revision-*，不混入最终版本表格。

## 内容验收的实际问题

覆盖、词义字段一致与篇幅可用代码验证，但无法证明语义合理。12词样例把实验室、羽毛、刚毛、蟋蟀与省钱强行联系，未说明清楚因果；12词复测把这些难词塞进板球赛装饰，场景选择同样牵强。其他组也有中文介词位置或搭配生硬之处。120词虽然全部覆盖且未截断，但出现名词及动作串列，不能视为自然短故事的合格证明。

另外独立试了3组单次内容编辑，结果保存在review-results.json。12词编辑仍未解决问题，因此未把额外审稿调用加入候选流程，以免增加耗时与tokens而缺乏明确收益。

当前结论：速度、覆盖、篇幅及后台调用数量有明确改善方向；随机难词组合的故事质量验收未通过。按照用户“完善并确认没问题后替换”的要求，不发布当前候选到线上。

## 程序与浏览器检查

- npm run test:mixed：9项通过，包含实际生成路由的混合/双语分支、普通计费、失败退款、短语/大小写/词边界、120词预算、有限重生成、闭合符修复、语境词义保留及关闭传输层重试。
- test:library、test:context通过；test:billing的8项执行检查通过，1项真实数据库检查未开启。
- Node语法检查与git diff --check通过。
- Playwright实际浏览器使用本地API夹具（真实DeepSeek正文、模拟登录/词典/云库），核对生成、6个高亮词及中文提示、本地例句译文、收藏、点击词汇后才请求详细释义。生成后详细词典请求为0、例句翻译请求为0；点击一个词后详细词典请求为1，语境释义未被模拟词典的不同释义覆盖，收藏写入本地夹具成功。未操作真实账号、积分或数据库。

浏览器请求记录：browser-qa.json；截图：../../output/playwright/mixed-a-desktop.png。代码文件SHA-256见code-snapshot.json。

## 完整正文与具体 Prompt

### theme-6（6词）

输入：sustainable, resilient, adapt, perspective, thrive, balance

为了sustainable收成，社区花园却因干旱土壤退化。园丁们选resilient耐旱品种，并adapt浇水方式。换一个perspective看，少水也能让作物thrive。最终花园恢复balance，产量稳定。

语境词义：sustainable（adj. 可持续的）；resilient（adj. 有适应力的）；adapt（v. 使适应）；perspective（n. 观点）；thrive（v. 茁壮成长）；balance（n. 平衡）

实际提示词和响应：raw/theme-6-1.prompt.txt、raw/theme-6-1.response.txt。

### mixed-12（12词）

输入：budget, relax, process, standard, attitude, motivation, derive, sterility, plume, bristle, cricket, expenses

我盯着budget发愁，决定先relax。我查了报销process和standard，调整attitude，找到motivation。我从sterility的实验室derive plume和bristle，又观察cricket，省下expenses。

语境词义：budget（n. 预算）；relax（v. 放松）；process（n. 流程）；standard（n. 标准）；attitude（n. 态度）；motivation（n. 动力）；derive（v. 获得）；sterility（n. 无菌状态）；plume（n. 羽毛）；bristle（n. 刚毛）；cricket（n. 蟋蟀）；expenses（n. 开支）

实际提示词和响应：raw/mixed-12-1.prompt.txt、raw/mixed-12-1.response.txt。

### long-24（24词）

输入：granite, terrain, arctic, deteriorate, gulf, meteorology, thermal, tropics, arid, humid, hail, thaw, shiver, budget, relax, process, standard, attitude, motivation, cover, reject, derive, contribute, expenses

为了在arctic高原建站，队长先看granite地基和terrain。budget很紧，expenses却涨。meteorology要求数据达standard。可天气deteriorate，hail砸下，队员shiver。他们reject普通材料，选thermal板。等thaw的process中，他们relax期限。attitude和motivation帮他们derive支持。从gulf来的湿气让humid空气cover设备，但arid内陆和tropics数据也contribute参考。最终站建成。

语境词义：granite（n. 花岗岩）；terrain（n. 地形）；arctic（adj. 北极的）；deteriorate（v. 恶化）；gulf（n. 海湾）；meteorology（n. 气象学）；thermal（adj. 保温的）；tropics（n. 热带）；arid（adj. 干旱的）；humid（adj. 潮湿的）；hail（n. 冰雹）；thaw（v. 解冻）；shiver（v. 发抖）；budget（n. 预算）；relax（v. 放宽）；process（n. 过程）；standard（n. 标准）；attitude（n. 态度）；motivation（n. 积极性）；cover（v. 覆盖）；reject（v. 拒绝）；derive（v. 获得）；contribute（v. 贡献）；expenses（n. 开支）

实际提示词和响应：raw/long-24-1.prompt.txt、raw/long-24-1.response.txt。

### mixed-12-repeat（12词）

输入：budget, relax, process, standard, attitude, motivation, derive, sterility, plume, bristle, cricket, expenses

budget很紧，我们仍要办cricket赛。先relax，再按process筹钱。场地standard不够，大家attitude积极。motivation来自观众。我们derive赞助，克服sterility。用plume和bristle装饰。expenses终于够用。

语境词义：budget（n. 预算）；relax（v. 放松）；process（n. 流程）；standard（n. 标准）；attitude（n. 态度）；motivation（n. 动力）；derive（v. 获得）；sterility（n. 贫瘠）；plume（n. 羽饰）；bristle（n. 刚毛）；cricket（n. 板球）；expenses（n. 开销）

实际提示词和响应：raw/mixed-12-repeat-1.prompt.txt、raw/mixed-12-repeat-1.response.txt。

### long-25（25词）

输入：granite, terrain, arctic, deteriorate, gulf, meteorology, thermal, tropics, arid, humid, hail, thaw, shiver, budget, relax, process, standard, attitude, motivation, cover, reject, derive, contribute, expenses, vacation

我原想去看granite和arctic terrain。但天气开始deteriorate，meteorology预报有hail。我的budget不够，expenses太高。我reject原计划，查了gulf边的tropics。那里不arid，也不太humid。我derive新motivation，改变attitude。我查thermal数据，按standard走完process。雪thaw时我不再shiver。云cover天空，我留在室内relax。这次vacation让我contribute了好心情。

语境词义：granite（n. 花岗岩）；terrain（n. 地形）；arctic（adj. 北极的）；deteriorate（v. 恶化）；gulf（n. 海湾）；meteorology（n. 气象学）；thermal（adj. 热量的）；tropics（n. 热带）；arid（adj. 干旱的）；humid（adj. 潮湿的）；hail（n. 冰雹）；thaw（v. 融化）；shiver（v. 发抖）；budget（n. 预算）；relax（v. 放松）；process（n. 过程）；standard（n. 标准）；attitude（n. 态度）；motivation（n. 动机）；cover（v. 覆盖）；reject（v. 拒绝）；derive（v. 获得）；contribute（v. 贡献）；expenses（n. 开支）；vacation（n. 假期）

实际提示词和响应：raw/long-25-1.prompt.txt、raw/long-25-1.response.txt。

### phrases（6词）

输入：take care of, care, don't, well-being, Mother, motherhood

我take care of生病的Mother。她需要care，却总说don't休息。我劝她为well-being躺下。motherhood让她习惯操劳，但这次她终于点头。

语境词义：take care of（phr. 照顾）；care（n. 照料）；don't（v. 不要）；well-being（n. 健康）；Mother（n. 母亲）；motherhood（n. 母职）

实际提示词和响应：raw/phrases-1.prompt.txt、raw/phrases-1.response.txt。

### single（1词）

输入：derive

科研小组要从实验数据derive可靠结论。数据杂乱，无法直接得出规律。他们重新整理记录，逐项核对。最终从干净数据中derive了明确结论。

语境词义：derive（v. 获得）

实际提示词和响应：raw/single-1.prompt.txt、raw/single-1.response.txt；raw/single-2.prompt.txt、raw/single-2.response.txt。

### new-school-12（12词）

输入：deadline, assignment, feedback, improve, confident, hesitate, submit, revise, schedule, focus, clarify, progress

deadline前，我的assignment初稿很差。我不再hesitate，去请老师clarify要求。我做了schedule，每天focus两小时来revise。看到progress后，我submit了作业。老师给feedback，我继续improve，变得confident。

语境词义：deadline（n. 截止日期）；assignment（n. 作业）；feedback（n. 反馈）；improve（v. 改进）；confident（adj. 自信的）；hesitate（v. 犹豫）；submit（v. 提交）；revise（v. 修改）；schedule（n. 日程安排）；focus（v. 集中注意力）；clarify（v. 澄清）；progress（n. 进展）

实际提示词和响应：raw/new-school-12-1.prompt.txt、raw/new-school-12-1.response.txt。

### new-random-15（15词）

输入：fragile, negotiate, orchard, invoice, beneath, reluctant, restore, harvest, consequence, borrow, precise, sufficient, transport, evidence, temporary

果农发现冷库门fragile，采收前必须修好。他先与银行negotiate，用orchard的invoice作evidence。银行起初reluctant，只给temporary额度。他borrow到一笔sufficient钱，请人restore冷库门。门beneath的轨道也换好。随后transport恢复，harvest按时入库。若拖延，consequence是水果腐烂；他记下precise温度，避免再坏。

语境词义：fragile（adj. 易损坏的）；negotiate（v. 谈判）；orchard（n. 果园）；invoice（n. 发票）；beneath（prep. 在……下面）；reluctant（adj. 不情愿的）；restore（v. 修复）；harvest（n. 收获）；consequence（n. 后果）；borrow（v. 借入）；precise（adj. 精确的）；sufficient（adj. 足够的）；transport（n. 运输）；evidence（n. 证据）；temporary（adj. 临时的）

实际提示词和响应：raw/new-random-15-1.prompt.txt、raw/new-random-15-1.response.txt；raw/new-random-15-2.prompt.txt、raw/new-random-15-2.response.txt。

### long-48-quick（48词）

输入：granite, terrain, arctic, deteriorate, gulf, meteorology, thermal, tropics, arid, humid, hail, thaw, shiver, budget, relax, process, standard, attitude, motivation, cover, reject, derive, contribute, expenses, sustainable, resilient, adapt, perspective, thrive, balance, camp, equipment, resource, shelter, challenge, cooperate, supply, rescue, route, safety, reliable, monitor, observe, record, analyse, evidence, predict, protect

granite和terrain让arctic考察队停下。天气开始deteriorate，gulf边风很大。meteorology数据说风暴会来。队员穿thermal衣服，从tropics到arid地区都训练过。这里却humid，还有hail。冰不thaw，大家冷得shiver。budget有限，不能relax。整个process要按standard走。队长的attitude和motivation鼓舞人。雪cover了路，他们reject冒险前进。从观察中derive判断，每人contribute力量。expenses要省，保持sustainable方式。队员很resilient，能adapt变化。换一个perspective，植物在短暂夏天thrive。他们找balance，回到camp。检查equipment和resource，搭好shelter。这是巨大challenge，必须cooperate。supply不够，等待rescue。改走安全route，safety第一。用reliable仪器monitor天气。他们observe云层，record数据。再analyse evidence，predict风暴。最后protect自己，成功返回。

语境词义：granite（n. 花岗岩）；terrain（n. 地形）；arctic（adj. 北极的）；deteriorate（v. 恶化）；gulf（n. 海湾）；meteorology（n. 气象学）；thermal（adj. 保暖的）；tropics（n. 热带）；arid（adj. 干旱的）；humid（adj. 潮湿的）；hail（n. 冰雹）；thaw（v. 融化）；shiver（v. 发抖）；budget（n. 预算）；relax（v. 放松）；process（n. 过程）；standard（n. 标准）；attitude（n. 态度）；motivation（n. 积极性）；cover（v. 覆盖）；reject（v. 拒绝）；derive（v. 获得）；contribute（v. 贡献）；expenses（n. 费用）；sustainable（adj. 可持续的）；resilient（adj. 适应力强的）；adapt（v. 适应）；perspective（n. 视角）；thrive（v. 茁壮成长）；balance（n. 平衡）；camp（n. 营地）；equipment（n. 设备）；resource（n. 资源）；shelter（n. 庇护所）；challenge（n. 挑战）；cooperate（v. 合作）；supply（n. 补给）；rescue（n. 救援）；route（n. 路线）；safety（n. 安全）；reliable（adj. 可靠的）；monitor（v. 监测）；observe（v. 观察）；record（v. 记录）；analyse（v. 分析）；evidence（n. 证据）；predict（v. 预测）；protect（v. 保护）

实际提示词和响应：raw/long-48-quick-1.prompt.txt、raw/long-48-quick-1.response.txt。

### limit-120（120词）

输入：granite, terrain, arctic, deteriorate, gulf, meteorology, thermal, tropics, arid, humid, hail, thaw, shiver, budget, relax, process, standard, attitude, motivation, cover, reject, derive, contribute, expenses, sustainable, resilient, adapt, perspective, thrive, balance, camp, equipment, resource, shelter, challenge, cooperate, supply, rescue, route, safety, reliable, monitor, observe, record, analyse, evidence, predict, protect, team, leader, station, coast, mountain, valley, river, forest, soil, seed, plant, water, garden, village, farmer, worker, repair, inspect, replace, connect, adjust, design, build, maintain, manage, organise, prepare, arrange, travel, arrive, return, collect, sample, measure, compare, estimate, calculate, decide, confirm, explain, discuss, report, publish, support, assist, deliver, request, refuse, accept, approve, reduce, increase, conserve, prevent, recover, stable, flexible, practical, efficient, responsible, curious, patient, cautious, urgent, modest, clear, useful, essential, annual, regional, global, local

granite山脊上，terrain复杂，arctic寒流让天气deteriorate。gulf边的meteorology团队要建站。thermal传感器从tropics到arid区都要用。humid空气、hail和thaw的冰雪让队员shiver。budget紧，不能relax。整个process要按standard来。队员的attitude和motivation很强。积雪cover山路，他们reject放弃。从当地derive帮助，每人contribute力量。expenses要低，方案要sustainable。队员resilient，能adapt。换perspective看，植物能thrive。保持balance，在camp清点equipment。resource和shelter是challenge。大家cooperate，supply不断。若有人遇险就rescue。选好route，注意safety。设备要reliable，能monitor。他们observe、record、analyse数据。evidence帮助predict天气，protect村民。team在leader带领下建station。从coast到mountain，穿过valley和river，经过forest。soil里播seed，plant并water，建小garden。village的farmer和worker来帮忙。他们repair、inspect、replace零件。connect线路，adjust角度。先design，再build，然后maintain。要manage时间，organise人手，prepare物资，arrange轮班。队员travel多日arrive，不久return。他们collect sample，measure温度，compare数据，estimate趋势，calculate均值。然后decide、confirm、explain、discuss，写report并publish。政府support，志愿者assist，车辆deliver物资。他们request更多帮助，不refuse建议，accept指导，上级approve计划。为reduce开支，不increase浪费，conserve能源，prevent故障。系统recover后保持stable。方案flexible、practical、efficient。每人responsible，保持curious、patient、cautious。处理urgent问题，目标modest。信号clear，数据useful，合作essential。annual报告、regional数据、global网络、local预警都建成。

语境词义：granite（n. 花岗岩）；terrain（n. 地形）；arctic（adj. 北极的）；deteriorate（v. 恶化）；gulf（n. 海湾）；meteorology（n. 气象学）；thermal（adj. 热量的）；tropics（n. 热带）；arid（adj. 干旱的）；humid（adj. 潮湿的）；hail（n. 冰雹）；thaw（v. 融化）；shiver（v. 颤抖）；budget（n. 预算）；relax（v. 放松）；process（n. 过程）；standard（n. 标准）；attitude（n. 态度）；motivation（n. 动机）；cover（v. 覆盖）；reject（v. 拒绝）；derive（v. 获得）；contribute（v. 贡献）；expenses（n. 费用）；sustainable（adj. 可持续的）；resilient（adj. 有韧性的）；adapt（v. 适应）；perspective（n. 视角）；thrive（v. 茁壮成长）；balance（n. 平衡）；camp（n. 营地）；equipment（n. 设备）；resource（n. 资源）；shelter（n. 庇护所）；challenge（n. 挑战）；cooperate（v. 合作）；supply（n. 供应）；rescue（v. 营救）；route（n. 路线）；safety（n. 安全）；reliable（adj. 可靠的）；monitor（v. 监测）；observe（v. 观察）；record（v. 记录）；analyse（v. 分析）；evidence（n. 证据）；predict（v. 预测）；protect（v. 保护）；team（n. 团队）；leader（n. 领导者）；station（n. 站点）；coast（n. 海岸）；mountain（n. 山）；valley（n. 山谷）；river（n. 河流）；forest（n. 森林）；soil（n. 土壤）；seed（n. 种子）；plant（v. 种植）；water（v. 浇水）；garden（n. 花园）；village（n. 村庄）；farmer（n. 农民）；worker（n. 工人）；repair（v. 修理）；inspect（v. 检查）；replace（v. 更换）；connect（v. 连接）；adjust（v. 调整）；design（v. 设计）；build（v. 建造）；maintain（v. 维护）；manage（v. 管理）；organise（v. 组织）；prepare（v. 准备）；arrange（v. 安排）；travel（v. 旅行）；arrive（v. 到达）；return（v. 返回）；collect（v. 收集）；sample（n. 样本）；measure（v. 测量）；compare（v. 比较）；estimate（v. 估计）；calculate（v. 计算）；decide（v. 决定）；confirm（v. 确认）；explain（v. 解释）；discuss（v. 讨论）；report（n. 报告）；publish（v. 发表）；support（v. 支持）；assist（v. 协助）；deliver（v. 递送）；request（v. 请求）；refuse（v. 拒绝）；accept（v. 接受）；approve（v. 批准）；reduce（v. 减少）；increase（v. 增加）；conserve（v. 保护）；prevent（v. 防止）；recover（v. 恢复）；stable（adj. 稳定的）；flexible（adj. 灵活的）；practical（adj. 实用的）；efficient（adj. 高效的）；responsible（adj. 负责的）；curious（adj. 好奇的）；patient（adj. 耐心的）；cautious（adj. 谨慎的）；urgent（adj. 紧急的）；modest（adj. 适度的）；clear（adj. 清晰的）；useful（adj. 有用的）；essential（adj. 必要的）；annual（adj. 每年的）；regional（adj. 区域的）；global（adj. 全球的）；local（adj. 当地的）

实际提示词和响应：raw/limit-120-1.prompt.txt、raw/limit-120-1.response.txt。

### 当前基础 Prompt（6词，中级，普通长度）

```text
为英语词汇学习直接生成一篇简短中文故事，不先写英文稿或翻译稿。
难度：中级。选一个可信场景，沿同一个具体事件写清行动、变化和结果。按故事逻辑安排词汇，不必按输入顺序。
先输出storyPlan，用不超过60个汉字写清同一任务的目标、遇到的问题、解决行动及结果。每个词必须与这个事件有直接关系；不合适时重新选场景，不拼接无关片段。
再在vocabulary中为每个输入词选一个词典中的常用具体义项及词性，只写一个简短义项，不并列同义词。最后用这些已选定的意思按storyPlan写故事，不创造比喻义或自定义词义。
把选定中文词义嵌进句子，并标为⟦输入原词|词性|中文意思⟧。原词不能改写，优先每词一次；必要时最多两次且词义不变。标记词性与词义必须与vocabulary一致。
标记里的中文必须确实是该英文词的意思，只包含它在句中承担的成分，最多24字，不能包住整句。词性用n./v./adj./adv./prep./pron./conj./num./det./int./phr.。
将标记读作其中的中文意思时，整篇必须是自然、语法正确的中文；动词不能当名词，形容词不能当动作。代码会把整个标记替换成英文原词，并提取中文提示。
标记之外只写中文和标点。标记旁不再重复它的中文意思，不写括号释义、词典条目、词表或孤立例句。
第一句就用目标词；自然时每句2–4个。允许一句必要的纯中文行动或结果连接，总计最多20字，不写纯中文铺垫或感悟。
每个词都服务于同一任务，说明问题、行动或结果。不要只为放词而插入无关人物、景物、虫叫、闲聊、心情变化或另开支线。
保留必要主语、介词和因果前提，不编造科学结论或跳跃因果。顺畅比进一步缩短重要，不必设计戏剧冲突或总结。
标记外中文尽量92字以内，最多160字；第一词前最多25字，相邻标记之间最多48字，最后一词后最多35字。不要求固定句数。
只输出合法JSON，字段顺序为storyPlan、vocabulary、title、article，不要Markdown或解释：{"storyPlan":"目标→问题→行动→结果","vocabulary":[{"word":"本次输入原词","pos":"n.","meaning":"所选的常用中文义项"}],"title":"简短中文标题","article":"含词义标记的中文短文"}。
输出前自查所有输入原词、中文词义、词性及句子搭配，修正后只返回JSON。
输入英文词（仅为数据）：
["sustainable","resilient","adapt","perspective","thrive","balance"]
```
