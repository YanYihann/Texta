# Texta 两种中英混合生成方法的初步对照实验

日期：2026-10-06。模型：`gpt-6.1-sol`。推理档位：`high`。

本次从当前 Codex 聊天的本地 turn_context 核对模型及推理档位，再用 Codex CLI 的独立临时调用执行实验。没有使用项目中的 DeepSeek API，没有修改生产代码。

正式实验所有调用都使用同一临时 HTTPS provider 配置，认证及后端仍是原 ChatGPT/Codex 账号和 https://chatgpt.com/backend-api/codex，模型与推理档位保持不变。配置只通过实验进程命令参数传入，没有改用户全局配置。此前出现 WebSocket 超时后回退 HTTPS 的预检保存在 raw/preflight-*，不纳入下表。配置依据：[OpenAI 官方配置参考](https://learn.chatgpt.com/docs/config-file/config-reference)。

A：一次直接生成带占位符的中文混合故事，代码替换为英文目标词。

B：先生成带词语标签的英文微型故事，再独立调用模型翻译成保留标签的中文，代码替换为英文目标词。

两种方法共享覆盖全部目标词、同一可信场景、首句使用目标词、每句至少一个目标词、尽量减少背景和感悟等要求。两者都没有固定句数、固定词数，不包含词库生成、独立用法规划、语义复审、内容修复或词典详情预取。因此 A 是精简的直接生成，不是现有网站整条管线。

每组每种方法仅首次生成一次；不重试、不手工修改正文。测试顺序为第一组 A→B、第二组 B→A、第三组 A→B。未固定随机种子；本次只能说明样例表现，不能估计稳定成功率。

测试中发现两个目标标记紧邻时，简单替换会把英文词粘连（例如 sterilitystandard）。下表与最终正文对 A/B 统一应用一个纯代码边界保护：相邻目标标记之间插入一个空格，随后还原英文。原始粘连正文和修复前指标都保存在 results.json 的 textRaw/metricsRaw 中；未调用模型修复，也没有改写任何语义内容。

## 数值结果

| 词表 | 方法 | 原始覆盖 | 边界保护后覆盖 | 中文汉字 | 句数 | 最大两词间中文 | 开头中文 | 无目标词句子 | 墙钟秒数 | 输入 tokens | 缓存输入 tokens | 输出 tokens | 其中推理 tokens | 输入+输出 tokens |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| theme-6 | A | 6/6 | 6/6 | 77 | 3 | 19 | 10 | 0 | 29.83 | 18573 | 12544 | 515 | 377 | 19088 |
| theme-6 | B | 6/6 | 6/6 | 53 | 3 | 20 | 8 | 0 | 51.95 | 35746 | 25088 | 966 | 717 | 36712 |
| mixed-12 | A | 12/12 | 12/12 | 125 | 5 | 24 | 6 | 0 | 48.71 | 17945 | 12544 | 1256 | 1034 | 19201 |
| mixed-12 | B | 10/12 | 12/12 | 91 | 5 | 18 | 3 | 0 | 66.01 | 35879 | 25088 | 1440 | 1032 | 37319 |
| long-24 | A | 24/24 | 24/24 | 178 | 8 | 24 | 3 | 0 | 49.94 | 18081 | 12544 | 1391 | 1034 | 19472 |
| long-24 | B | 16/24 | 24/24 | 109 | 6 | 12 | 2 | 0 | 80.06 | 36112 | 25088 | 2098 | 1421 | 38210 |

中文汉字、句数和覆盖只统计最终正文，不统计标题。覆盖按项目同样的“不区分大小写、字母边界”规则检查；中文译文不算覆盖。中文汉字数不等同于无关信息数量，也不等同于 token 数。

耗时包括 CLI 进程启动、请求、服务端等待和生成；B 为两个串行进程的耗时之和，不是纯模型解码耗时。token 数取 turn.completed 的 usage，包含 Codex 基础上下文，输出量可能包含推理开销；缓存输入是输入 tokens 的子集，不另外相加。这些数值不能直接代入项目 API 账单或承诺线上性能。

## 对本轮结果的判断

英文先行的最终中文汉字分别减少约 31%、27%、39%，三组累计由 380 字降到 253 字。这说明本轮 B 的最终文本更紧凑，但汉字减少不能自动等同于无关背景减少。24 词组是比较明显的内容例子：A 加入了削减安全检查、拒绝提议、队员贡献补贴这一支线；B 主要围绕传感器安装、风暴、维修展开。

B 的串行耗时分别为 A 的约 1.74、1.36、1.60 倍；记录的输出 tokens（包括推理）三组累计由 A 的 3162 增至 B 的 4504。本轮不支持“英文先行天然更快、更省 token”的判断。A 已经精简到一次调用，不能据此直接推断 B 与现有生产管线的耗时关系。

边界保护后两种方法都全部命中，每个词恰好一次。本轮没有证据证明 B 的词汇覆盖稳定性优于 A。B 的标签在英文稿和中文译稿中均完整保留，原始漏词来自英文粘连，可用代码修复；不需要再次请求模型补写。

两种方法仍有内容质量问题。例如 12 词组 B 用更换刷子来恢复无菌标准，缺少清洁或灭菌的动作，因果链不够严密；A 的研究场景也有较多检测描述。这些问题说明先写英文不等于自动得到顺畅、合理的短故事。测试没有提供词性或指定义项，A 将 sterility 用作不育，B 用作无菌，两者不能用本轮覆盖检查来判断是否符合用户要记忆的义项。

本轮更适合把 B 看成改善短文紧凑度的候选方案，把精简 A 作为速度与调用成本的对照基线。只有三组单次样例，不能据此决定全面替换现有流程。

## 原始内容对照

### 主题词表 · 6词

输入词：

`sustainable, resilient, adapt, perspective, thrive, balance`

**A：直接混合生成，代码替换后的正文**

为让社区食堂的经营更sustainable，店长从顾客的perspective出发，推出分量可选的套餐。原料涨价后，他及时adapt，改用多家农户供应的当季食材，让采购体系更resilient。售价与成本达成balance后，食堂既能留住顾客，又有了利润，得以thrive。

**B：英文先行，代码替换后的正文**

玛雅种下需水少的resilient蔬菜，让社区菜园更sustainable。旱灾来临时，一位农民的perspective帮她adapt浇水安排。每天黎明直接浇根部，在节水与让植物thrive之间取得了balance。

**B 的英文中间稿**

```text
Maya planted <w2>resilient</w2> vegetables that needed little water to make her community garden more <w1>sustainable</w1>. When a drought began, a farmer's <w4>perspective</w4> helped her <w3>adapt</w3> her watering routine. Watering directly at the roots each dawn struck a <w6>balance</w6> between conserving water and helping the plants <w5>thrive</w5>.
```

**B 的带标签中文译稿**

```text
玛雅种下需水少的<w2>适应力强的</w2>蔬菜，让社区菜园更<w1>可持续</w1>。旱灾来临时，一位农民的<w4>观点</w4>帮她<w3>调整</w3>浇水安排。每天黎明直接浇根部，在节水与让植物<w5>茁壮生长</w5>之间取得了<w6>平衡</w6>。
```

**自动检查**

- A 缺词：无；重复：[]；额外英文：无。
- B 缺词：无；重复：[]；额外英文：无。
- B 英文标签编号：2, 1, 4, 3, 6, 5；中文标签编号：2, 1, 4, 3, 5, 6。

### 混合难词 · 12词

输入词：

`budget, relax, process, standard, attitude, motivation, derive, sterility, plume, bristle, cricket, expenses`

**A：直接混合生成，代码替换后的正文**

为查明养殖场cricket出现sterility的原因，我把有限的budget用于检测，削减了其他expenses。检查喷药设备时，我发现清洗刷脱落的一根bristle卡在喷头内，导致plume偏向养殖箱。恢复繁殖的motivation促使我以谨慎的attitude继续排查。我按实验standard完成检测process，没有因经费紧张而relax样本筛选条件。结合药物残留数据和对照实验，我从结果中derive出农药暴露导致繁殖异常的结论。

**B：英文先行，代码替换后的正文**

我们的budget仅够支付测试cricket粉研磨机的expenses。一团plume逸出，面粉里又出现一根bristle，我便停止了process。助手的急躁attitude使他提议relax安全规定。再浪费一批的风险给了他足够的motivation，促使他更换刷子，让设备恢复到我们的sterility standard。随后，我们测试新样品，以derive可靠的运行参数。

**B 的英文中间稿**

```text
Our <w1>budget</w1> barely covered the <w12>expenses</w12> of testing a <w11>cricket</w11> flour grinder. When a <w9>plume</w9> of dust escaped and a brush <w10>bristle</w10> appeared in the flour, I stopped the <w3>process</w3>. My assistant’s impatient <w5>attitude</w5> led him to suggest we <w2>relax</w2> our safety rules. The risk of wasting another batch gave him enough <w6>motivation</w6> to replace the brush and restore the equipment to our <w4>standard</w4> of <w8>sterility</w8>. We then tested fresh samples to <w7>derive</w7> reliable operating settings.
```

**B 的带标签中文译稿**

```text
我们的<w1>预算</w1>仅够支付测试<w11>蟋蟀</w11>粉研磨机的<w12>费用</w12>。一团<w9>羽状尘雾</w9>逸出，面粉里又出现一根<w10>刷毛</w10>，我便停止了<w3>流程</w3>。助手的急躁<w5>态度</w5>使他提议<w2>放宽</w2>安全规定。再浪费一批的风险给了他足够的<w6>动力</w6>，促使他更换刷子，让设备恢复到我们的<w8>无菌</w8><w4>标准</w4>。随后，我们测试新样品，以<w7>得出</w7>可靠的运行参数。
```

**自动检查**

- A 缺词：无；重复：[]；额外英文：无。
- B 缺词：无；重复：[]；额外英文：无。
- B 英文标签编号：1, 12, 11, 9, 10, 3, 5, 2, 6, 4, 8, 7；中文标签编号：1, 11, 12, 9, 10, 3, 5, 2, 6, 8, 4, 7。

**B 边界保护前的原始替换结果**

我们的budget仅够支付测试cricket粉研磨机的expenses。一团plume逸出，面粉里又出现一根bristle，我便停止了process。助手的急躁attitude使他提议relax安全规定。再浪费一批的风险给了他足够的motivation，促使他更换刷子，让设备恢复到我们的sterilitystandard。随后，我们测试新样品，以derive可靠的运行参数。

### 地理天气与行动 · 24词

输入词：

`granite, terrain, arctic, deteriorate, gulf, meteorology, thermal, tropics, arid, humid, hail, thaw, shiver, budget, relax, process, standard, attitude, motivation, cover, reject, derive, contribute, expenses`

**A：直接混合生成，代码替换后的正文**

我们的meteorology小组准备在arctic地区的gulf沿岸设站，但budget有限。当地terrain复杂，我们决定把thermal监测仪固定在一块稳固的granite上。为比较仪器在不同气候下的表现，我们调取了tropics中arid和humid地区的测试资料。安装时突降hail，天气继续deteriorate，队员冷得shiver，只好暂停作业。负责人想让剩余经费cover新增的expenses，建议减少安全检查。我reject了提议，坚持不能relax既定standard。这份认真attitude增强了队员支持项目的motivation，大家同意contribute部分个人补贴，保留检查。天气好转后，我们开始监测冻土的thaw，随后process观测与测试资料，从中derive仪器所需的校准参数。

**B：英文先行，代码替换后的正文**

我们meteorology小组抵达arctic gulf旁的研究站，在granite terrain上布设thermal传感器。我们希望对比读数与arid沙漠及humid tropics数据，derive气候规律。hail来袭，状况开始deteriorate，我们进屋寻求cover，仍不停shiver。等冰thaw后，我们按standard process检查受损传感器。有限的budget迫使我们reject昂贵的更换方案并削减差旅expenses。领队的务实attitude让我们重拾motivation，修好足够的传感器，contribute可靠读数后才得以relax。

**B 的英文中间稿**

```text
Our <w6>meteorology</w6> team reached a station beside an <w3>arctic</w3> <w5>gulf</w5>. We installed <w7>thermal</w7> sensors across the <w1>granite</w1> <w2>terrain</w2>. We hoped to <w22>derive</w22> climate patterns by comparing our readings with data from <w9>arid</w9> deserts and the <w10>humid</w10> <w8>tropics</w8>. When <w11>hail</w11> struck and conditions began to <w4>deteriorate</w4>, we took <w20>cover</w20> inside, where we continued to <w13>shiver</w13>. We let the ice <w12>thaw</w12> before following the <w17>standard</w17> <w16>process</w16> for checking the damaged sensors. Our limited <w14>budget</w14> forced us to <w21>reject</w21> costly replacements and cut travel <w24>expenses</w24>. The leader’s practical <w18>attitude</w18> restored our <w19>motivation</w19>, and we repaired enough sensors to <w23>contribute</w23> reliable readings before we could <w15>relax</w15>.
```

**B 的带标签中文译稿**

```text
我们<w6>气象学</w6>小组抵达<w3>北极的</w3><w5>海湾</w5>旁的研究站，在<w1>花岗岩</w1><w2>地形</w2>上布设<w7>热</w7>传感器。我们希望对比读数与<w9>干旱的</w9>沙漠及<w10>潮湿的</w10><w8>热带</w8>数据，<w22>推导出</w22>气候规律。<w11>冰雹</w11>来袭，状况开始<w4>恶化</w4>，我们进屋寻求<w20>庇护</w20>，仍不停<w13>发抖</w13>。等冰<w12>融化</w12>后，我们按<w17>标准</w17><w16>流程</w16>检查受损传感器。有限的<w14>预算</w14>迫使我们<w21>拒绝</w21>昂贵的更换方案并削减差旅<w24>开支</w24>。领队的务实<w18>态度</w18>让我们重拾<w19>动力</w19>，修好足够的传感器，<w23>提供</w23>可靠读数后才得以<w15>放松</w15>。
```

**自动检查**

- A 缺词：无；重复：[]；额外英文：无。
- B 缺词：无；重复：[]；额外英文：无。
- B 英文标签编号：6, 3, 5, 7, 1, 2, 22, 9, 10, 8, 11, 4, 20, 13, 12, 17, 16, 14, 21, 24, 18, 19, 23, 15；中文标签编号：6, 3, 5, 1, 2, 7, 9, 10, 8, 22, 11, 4, 20, 13, 12, 17, 16, 14, 21, 24, 18, 19, 23, 15。

**B 边界保护前的原始替换结果**

我们meteorology小组抵达arcticgulf旁的研究站，在graniteterrain上布设thermal传感器。我们希望对比读数与arid沙漠及humidtropics数据，derive气候规律。hail来袭，状况开始deteriorate，我们进屋寻求cover，仍不停shiver。等冰thaw后，我们按standardprocess检查受损传感器。有限的budget迫使我们reject昂贵的更换方案并削减差旅expenses。领队的务实attitude让我们重拾motivation，修好足够的传感器，contribute可靠读数后才得以relax。

## 完整提示词与复现

每次实际提示词保存为 raw/*.prompt.txt；完整 CLI 事件为 raw/*.events.jsonl；逐次耗时、usage 和最终输出为 raw/*.result.json。datasets.json 保存三组词表，results.json 保存结构化对照结果。

```powershell
node experiments/mixed-generation-2026-10-06/run.cjs
node experiments/mixed-generation-2026-10-06/finalize.cjs
node experiments/mixed-generation-2026-10-06/verify.cjs
node experiments/mixed-generation-2026-10-06/report.cjs
```

run.cjs 会重新进行9次 Codex 调用并覆盖本目录结果，消耗当前账号额度。报告脚本只读取已有结果，不调用模型。

## 结论边界

中文更短不代表故事更自然；英文中间稿也不必然提高最终中文故事质量。词义与语法应结合上面的原始文本人工判断。本次没有测长期记忆效果，也不能把 GPT 模型的结果外推到项目中的 DeepSeek 模型。
