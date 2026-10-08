# 双语文章重构：Codex模型实验

2026-10-06。最终使用当前对话配置的gpt-6.1-sol，high推理强度。所有生成样例通过Codex登录执行，未读取Texta的.env或API key，未调用用户的API/DeepSeek服务。网页检查使用127.0.0.1本地模拟服务。未部署到线上。

## 结果与边界

下表是最终固定版本的8组测试，包含一组同词表的独立重复样例。词汇覆盖、句对编号、原词边界、词性格式、标记完整性和长度检查均通过。覆盖通过不等于语义一定正确；本轮同时人工阅读故事和译文。样本数不足以估计稳定成功率。初始版本及中间修订输出完整保留在results.json、final-results.json和raw目录，未混入最终统计。

| 样例 | 输入词 | 模式 | 模型调用 | 英文词数 | CLI总耗时秒 | 输入tokens | 输出tokens | 其中推理tokens |
|---|---:|---|---:|---:|---:|---:|---:|---:|
| theme-6 | 6/6 | 普通 | 1 | 133 | 48.8 | 18936 | 1026 | 516 |
| random-12 | 12/12 | 普通 | 1 | 177 | 84.5 | 18272 | 2285 | 1552 |
| random-12-short | 12/12 | 短文 | 1 | 127 | 65.8 | 18962 | 1866 | 1278 |
| weather-24 | 24/24 | 普通 | 1 | 261 | 105.2 | 18341 | 3271 | 2035 |
| phrases-6 | 6/6 | 普通 | 1 | 121 | 54.5 | 18936 | 1461 | 992 |
| single-short | 1/1 | 短文 | 1 | 77 | 27.2 | 18204 | 646 | 392 |
| overlap-6 | 6/6 | 普通 | 1 | 114 | 52.7 | 18238 | 1469 | 1034 |
| theme-6-repeat | 6/6 | 普通 | 1 | 121 | 48.3 | 18240 | 1136 | 672 |

CLI耗时包括进程启动、服务排队和high推理；输入token包含Codex系统环境，输出token包含推理。以上不是网站的API耗时或纯应用token预算，不能用于宣称DeepSeek提速/节省的百分比。新代码从词典→英文→翻译→对齐至少4个串行内容步骤，改为正常1次请求；仅检查失败时追加1次完整生成。完整词典不在生成阶段请求，例句译文直接复用。减少耗时和token的理由来自这些结构变化，实际改善需要后续真实服务验证。

## 内容检查

重点检查随机词表是否形成可以理解的任务，而不是词汇罗列；是否选用真实常用义项；是否有不自然的译义片段。早期模型把plume标成“缕”或“股”，已补充名词核心含义要求、通用名词短语示例和孤立量词校验后重新测试。未手工修改最终样例正文。短语及相似单词通过精确标记位置高亮，避免把art命中到article，或者把中文重复词语全部误高亮。

## 最终应用prompt（12词，普通模式）

```text
为单词学习写一篇自然英文故事及忠实中文翻译。目标是通过具体语境理解词义和用法。
先在心中选择能合理容纳全部词汇的事件，安排起因、行动、变化、结果；按逻辑使用词，不按词表顺序写。词表跨度大时可沿同一人物的实际任务推进，但不要强加科学因果或为了放词另开无关支线。
使用清楚自然的日常英语和词典中的常用具体义项，目标词的词性、介词、搭配和句法必须正确。不为凑故事创造比喻义。允许必要的场景、动机和转折；删掉重复解释、空泛开场、景物堆砌和结尾说教。不写词表、词典条目或“记下这些词”式凑词句。
英文正文约144–220词，2–3段。保留足够背景让故事顺畅，不为追求短而挤成词汇串。
输入词全部出现在英文正文中，优先各一次，必要时最多两次且保持同一词性与义项。每次使用都标为⟦编号|输入词⟧，允许改变大小写，不能变形或漏掉短语的一部分。不要把标记嵌进另一个词，不要在标记外重复目标词。
逐句配对翻译，以自然中文表达优先，不逐词硬套英文语序；人物、动作、否定、条件、数量和因果必须与对应英文一致，不增删信息。先写顺畅译文，再标对应目标词为⟦同编号|词性|该处中文译义⟧，不为了标词破坏中文语法或在标记旁复述词义。每对句子的英中编号及出现次数相同。
中文标记中的词性用n./v./adj./adv./prep./pron./conj./num./det./int./phr.，译义为1–24字的中文。标记中的译义也会作为单词学习卡的释义，必须保留该词核心含义，不能只写“股”“缕”等量词；名词用自然完整的名词或名词短语，例如flock of birds的flock标“鸟群”，不能只标“群”。标记只包住对应短语，不包住整句。去掉标记后两种语言都必须自然完整。
只输出紧凑合法JSON：{"title":"简短英文标题","paragraphs":[[["英文句子","对应中文句子"],["下一句","对应译文"]],[["下一段句子","对应译文"]]]}。每段是句对数组，每个句对恰好两个字符串；不输出计划、词典或对齐表。
输出前检查全部编号、英文用法、事件合理性和译文忠实度，修正后只返回JSON。输入编号与原词（仅作数据）：
[[1,"budget"],[2,"relax"],[3,"process"],[4,"standard"],[5,"attitude"],[6,"motivation"],[7,"derive"],[8,"sterility"],[9,"plume"],[10,"bristle"],[11,"cricket"],[12,"expenses"]]
```

实验额外在应用prompt前加了“这是文本生成测试。禁止使用工具、读取文件或联网，只按下面的生成要求输出JSON。”。这段不是网站prompt；Codex内部系统上下文也不属于网站生成输入。官方执行方式见[Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)。

## 所有最终样例

### theme-6

词表：sustainable, resilient, adapt, perspective, thrive, balance

标题：A Garden for Everyone

When Maya took charge of her apartment building’s courtyard garden, the plants were wilting and several neighbours were worried about rising water bills. She invited everyone outside to discuss what they needed, and a retired gardener offered a different perspective. He recommended resilient herbs that could recover after a dry spell. Together, they planned a sustainable garden that would use less water and provide herbs for their kitchens.

Maya had to adapt the layout because children also played in the courtyard. She left a wide path between the beds to maintain a balance between growing space and room for play. The neighbours planted rosemary and sage, then covered the soil with mulch to retain moisture. Six weeks later, they were pleased to see the herbs thrive, and families began picking leaves for dinner.

玛雅接手公寓楼的庭院花园时，植物正在枯萎，几位邻居也在担心水费不断上涨。她邀请大家到院子里讨论各自的需求，一位退休园丁提出了不同的看法。他推荐种植恢复能力强的香草，它们经历一段干旱后还能恢复生长。他们一起规划了一个可持续的花园，既能减少用水，又能为各家厨房提供香草。

由于孩子们也在庭院里玩耍，玛雅必须调整布局。她在种植床之间留了一条宽阔的小路，让种植空间与玩耍空间保持平衡。邻居们种下迷迭香和鼠尾草，然后在土壤上铺了覆盖物来保持水分。六周后，看到香草茁壮生长，大家都很高兴，各家也开始采摘叶子做晚饭。

语境释义：sustainable（adj. 可持续的）；resilient（adj. 恢复能力强的）；adapt（v. 调整）；perspective（n. 看法）；thrive（v. 茁壮生长）；balance（n. 平衡）

### random-12

词表：budget, relax, process, standard, attitude, motivation, derive, sterility, plume, bristle, cricket, expenses

标题：A Match for the Clinic

Maya volunteered to organize a charity cricket match to help the village clinic buy a new sterilizer. She drew up a budget and kept expenses low by borrowing equipment and asking local shops to donate refreshments. Before printing the posters, she visited the clinic to understand why the new machine was needed. During the cleaning process, the nurse noticed a loose bristle and replaced the brush. A plume of steam rose from the old sterilizer when the cycle ended. The nurse explained that a replacement would make it easier to maintain the sterility of surgical tools and meet the clinic's safety standard.

The visit gave Maya fresh motivation to find more sponsors for the match. She began to derive real satisfaction from finding people who could lend equipment or give their time. One shopkeeper's dismissive attitude discouraged her briefly, but the next offered to print the posters free. By Saturday evening, ticket sales and donations had raised enough money to order the machine. Maya could finally relax while the volunteers packed away the bats and folding chairs.

玛雅自愿组织一场慈善板球比赛，帮助村里的诊所购置一台新消毒器。她编制了一份预算，并通过借用器材、请当地商店捐赠茶点来控制开支。印制海报前，她去了诊所，了解为什么需要这台新设备。在清洗过程中，护士发现一根松动的刷毛，便换了一把刷子。消毒程序结束时，一道蒸汽柱从旧消毒器中升起。护士解释说，更换设备能让他们更容易保持手术器械的无菌状态，并达到诊所的安全标准。

这次探访给了玛雅新的动力，促使她为比赛寻找更多赞助者。找到愿意借出器材或投入时间帮忙的人，让她开始从中获得实实在在的满足感。一位店主轻慢的态度一度让她泄气，但下一位店主提出免费印制海报。到星期六晚上，门票收入和捐款已经足够订购那台设备。志愿者们收起球棒和折叠椅时，玛雅终于可以放松一下了。

语境释义：budget（n. 预算）；relax（v. 放松）；process（n. 过程中）；standard（n. 标准）；attitude（n. 态度）；motivation（n. 动力）；derive（v. 获得）；sterility（n. 无菌状态）；plume（n. 蒸汽柱）；bristle（n. 刷毛）；cricket（n. 板球）；expenses（n. 开支）

### random-12-short

词表：budget, relax, process, standard, attitude, motivation, derive, sterility, plume, bristle, cricket, expenses

标题：Ready for the Workshop

Our school had a small budget for a workshop on growing plants in sterile jars, so I volunteered to clean the laboratory and reduce expenses. My motivation was simple: I wanted everyone to try it. A cricket jumped from under a bench as I swept, and I found a loose bristle inside an empty jar. The teacher showed me the cleaning process and explained that sterility was the standard required for the equipment.

Once the cleaned equipment was in the sterilizer, a plume of steam rose from its vent. My attitude changed when I saw how much care the work required. I began to derive satisfaction from getting each step right. When the teacher checked everything and said we were ready for tomorrow, I could finally relax.

学校为一个在无菌罐中培育植物的实践活动安排的预算很少，所以我自愿打扫实验室，减少开支。我的动力很简单：我希望每个人都能试一试。我扫地时，一只蟋蟀从长凳底下跳了出来，我还在一个空罐子里发现了一根脱落的刷毛。老师向我演示了清洁流程，并解释说，设备必须达到无菌状态这一标准。

清洁过的设备放进灭菌器后，一股蒸汽从灭菌器的排气口升起。看到这项工作需要如此细心，我的态度发生了变化。我开始从做好每一个步骤中获得满足感。老师检查了所有东西，说我们已经为明天做好了准备，这时我终于可以放松了。

语境释义：budget（n. 预算）；relax（v. 放松）；process（n. 流程）；standard（n. 标准）；attitude（n. 态度）；motivation（n. 动力）；derive（v. 获得）；sterility（n. 无菌状态）；plume（n. 一股蒸汽）；bristle（n. 刷毛）；cricket（n. 蟋蟀）；expenses（n. 开支）

### weather-24

词表：granite, terrain, arctic, deteriorate, gulf, meteorology, thermal, tropics, arid, humid, hail, thaw, shiver, budget, relax, process, standard, attitude, motivation, cover, reject, derive, contribute, expenses

标题：The Sensor Across the Bay

After studying meteorology, Nina accepted a summer job at an arctic weather station overlooking a narrow gulf. She had grown up in the tropics and had never worked in such a cold place. Her first job was to process readings from other stations, including one on an arid plateau and another on a humid coast. Her motivation for coming was simple: she wanted experience collecting the measurements she usually saw only on a screen.

A week later, her supervisor asked her to check a faulty sensor across the bay. The station's tight budget would cover her travel expenses, but there was no money for a replacement sensor. She followed the standard procedure and tested a spare cable before packing it with her tools. She also packed thermal gloves.

Her supervisor took her across by boat and studied the terrain before choosing a path to the sensor. An early thaw had left deep mud between slabs of granite, so they moved slowly. When hail began to strike their jackets, Nina felt herself shiver. They stopped under a shelter as conditions continued to deteriorate. Her supervisor decided to reject her suggestion that they hurry on; they would wait until it was safe.

The shower passed after twenty minutes, and the spare cable restored the sensor's connection. Back at the station, Nina could finally relax over a hot meal. Her supervisor thanked her for keeping a practical attitude when the plan changed. The next morning, she used the repaired sensor's readings to derive an average overnight temperature and contribute to the team's weekly report.

学过气象学后，妮娜接受了一份暑期工作，工作地点是一座位于北极地区的气象站，从那里可以俯瞰一个狭窄的海湾。她在热带地区长大，从未在这么冷的地方工作过。她的第一项工作是处理其他气象站的观测数据，其中一个站位于干旱的高原，另一个位于潮湿的海岸。促使她来到这里的动机很简单：她想获得实地采集观测数据的经验，而这些数据她平时只能在屏幕上看到。

一周后，她的主管让她去检查海湾对岸一个出了故障的传感器。气象站的预算有限，能支付她的差旅费用，但没有钱购买替换用的传感器。她按照标准的操作流程测试了一根备用电缆，然后将它和工具一起装好。她还装了一副保暖的手套。

主管乘船带她到了对岸，先查看了地形，然后选了一条通往传感器的路。提前到来的解冻期使大片花岗岩之间积着厚厚的烂泥，所以他们走得很慢。当冰雹开始砸在他们的夹克上时，妮娜感觉自己在发抖。随着天气状况持续恶化，他们停下来，在一处遮蔽物下避雨。妮娜建议赶紧继续走，但主管决定拒绝这个提议；他们会等到安全了再出发。

二十分钟后，阵雨过去了，备用电缆使传感器恢复了连接。回到气象站后，妮娜终于可以一边吃着热饭，一边放松了。主管感谢她在计划发生变化时仍保持务实的态度。第二天早上，她用修复后的传感器记录的数据计算得出了夜间平均温度，并为团队的每周报告作出贡献。

语境释义：granite（n. 花岗岩）；terrain（n. 地形）；arctic（adj. 北极地区的）；deteriorate（v. 恶化）；gulf（n. 海湾）；meteorology（n. 气象学）；thermal（adj. 保暖的）；tropics（n. 热带地区）；arid（adj. 干旱的）；humid（adj. 潮湿的）；hail（n. 冰雹）；thaw（n. 解冻期）；shiver（v. 发抖）；budget（n. 预算）；relax（v. 放松）；process（v. 处理）；standard（adj. 标准的）；attitude（n. 态度）；motivation（n. 动机）；cover（v. 支付）；reject（v. 拒绝）；derive（v. 计算得出）；contribute（v. 作出贡献）；expenses（n. 费用）

### phrases-6

词表：take care of, don't, well-being, Mother, care, look forward to

标题：A Weekend at Home

Mother had hurt her ankle, so I came home for the weekend to help. She needed extra care, but she hated asking me to do everything. I offered to take care of the shopping and dinner while she rested. At first, she kept getting up to check what I was doing. "Please don't worry about the kitchen," I said, handing her a cup of tea.

By Saturday evening, I realized that her well-being depended on more than a clean house. She missed having company, so I sat beside her and asked about her week. We talked until dinner was ready, then made plans for Sunday. "I always look forward to your visits," she said, "and tomorrow we can have breakfast outside."

母亲脚踝受了伤，于是我周末回家帮忙。她需要更多照料，但她很不愿意什么事都叫我做。我主动提出，她休息时，购物和做晚饭都由我来负责处理。起初，她总是站起来看看我在做什么。“请不要为厨房的事操心，”我说着，递给她一杯茶。

到周六晚上，我意识到，她的身心健康取决于的不只是家里是否干净。她很想有人陪着，于是我坐在她身旁，问起她这一周过得怎么样。我们一直聊到晚饭做好，然后安排了周日要做的事。“我总是期待你来看我，”她说，“明天我们可以在外面吃早餐。”

语境释义：take care of（phr. 负责处理）；don't（phr. 不要）；well-being（n. 身心健康）；Mother（n. 母亲）；care（n. 照料）；look forward to（phr. 期待）

### single-short

词表：cover

标题：A Saved Table

Maya wanted to paint her kitchen before her parents arrived for the weekend. She moved the chairs into the hallway and used an old sheet to cover the wooden table. Halfway through the job, she caught her sleeve on the paint tray and tipped it over. The sheet soaked up the spilled paint, so none reached the wood. She finished the wall, carried the dirty sheet outside, and put the furniture back just before the doorbell rang.

玛雅想在父母来过周末之前，把厨房刷好。她把椅子搬到走廊里，用一条旧床单盖住了木桌。刷到一半时，她的袖子钩住了油漆托盘，把它带翻了。床单吸住了洒出的油漆，所以一点油漆也没沾到木头上。她刷完墙，把脏床单拿到外面，又把家具搬回原位，刚忙完门铃就响了。

语境释义：cover（v. 盖住）

### overlap-6

词表：art, article, in, in spite of, record, recording

标题：Pictures for the Library

When a leaking roof forced the village library to close, Maya organized an exhibition of local art to help pay for repairs. She borrowed the school hall and asked a local newspaper to publish an article about the event. Several painters offered pictures for sale, and she kept a written record of every picture's price.

On Saturday, Maya hung the pictures in the hall. She also played a recording of her grandfather describing how the library had helped him learn to read. People came in spite of the heavy rain, and by lunchtime most of the pictures had been sold. The painters gave half their earnings to the library, which reopened three weeks later.

屋顶漏水迫使村里的图书馆关闭，玛雅便组织了一场当地艺术作品展，帮助筹措维修资金。她借用了学校的大厅，并请一家当地报纸刊登一篇介绍这次活动的文章。几位画家拿出画作出售，她为每幅画的价格都做了书面记录。

周六，玛雅把画作挂在大厅里。她还播放了一段祖父的录音，其中他讲述了图书馆如何帮助他学会阅读。尽管下着大雨，人们还是来了，到午饭时，大多数画作都已售出。画家们把收入的一半捐给了图书馆，三周后，图书馆重新开放了。

语境释义：art（n. 艺术作品）；article（n. 文章）；in（prep. 在）；in spite of（phr. 尽管）；record（n. 记录）；recording（n. 录音）

### theme-6-repeat

词表：sustainable, resilient, adapt, perspective, thrive, balance

标题：The School Garden

When Mia took charge of the school garden, the soil was dry, and nobody could water the plants during the summer break. She needed a sustainable way to keep the garden alive without daily visits. Her teacher suggested looking at the problem from a different perspective: choose plants that suited the conditions. Together, they replaced the struggling flowers with resilient herbs and covered the soil with mulch to hold moisture.

Mia had to adapt their watering schedule to the weather, visiting more often during hot weeks. She also needed to balance gardening with homework, so two classmates agreed to share the work. By September, the herbs had begun to thrive, and the three students were picking mint for the school kitchen.

米娅接手学校的花园时，土壤很干，而且暑假期间没人能给植物浇水。她需要一种可持续的方法，让花园里的植物活下去，又不用每天过来。老师建议换个角度看这个问题：选择适合这些条件的植物。她们一起把长势不佳的花换成了恢复能力强的香草植物，并在土壤上铺了覆盖物来保持水分。

米娅必须根据天气调整她们的浇水安排，在天气炎热的那几周更频繁地过来。她还需要兼顾园艺工作和家庭作业，所以两位同学答应分担工作。到了九月，香草植物已经开始茁壮生长，三个学生正为学校厨房采摘薄荷。

语境释义：sustainable（adj. 可持续的）；resilient（adj. 恢复能力强的）；adapt（v. 调整）；perspective（n. 角度）；thrive（v. 茁壮生长）；balance（v. 兼顾）

## 代码与验证

生成模块SHA256：27dc0acd2aafa04d5b5279cb07faba122594dc2f7785d294e1d72e81d708218e

npm run test:bilingual：6项通过。npm run test:mixed：9项通过（包括两种模式的真实路由契约、失败退款与旧字段兼容）。test:context与test:library通过。test:billing：8项通过，真实数据库集成1项因未配置测试数据库跳过。浏览器结果记录在browser-qa.json，截图在output/playwright。
