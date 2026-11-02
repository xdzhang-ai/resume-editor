// Initial resume content — a realistic Chinese tech resume matching the design reference.
import { createModule, uid } from './moduleTypes.js'

function mod(type, title, data) {
  const m = createModule(type)
  if (title) m.title = title
  if (data) m.data = data
  return m
}

export const sampleResume = {
  meta: {
    templateId: 'modern',
    themeColor: '#2f6df6',
    fontFamily: '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
    baseFontSize: 13,
    lineHeight: 1.6,
    paperSize: 'A4',
    accentSoft: true
  },
  modules: [
    mod('personal', '基本信息', {
      name: '张晓冬',
      title: 'Java 后端开发工程师',
      phone: '158-6759-3719',
      email: 'chfly97@163.com',
      location: '上海',
      website: 'github.com/chfly97',
      summary: '5 年 Java 后端开发经验，专注于高并发、分布式系统设计与性能优化，主导过多个千万级用户平台的架构演进。'
    }),
    mod('education', '教育经历', {
      items: [
        {
          id: uid('i'),
          school: '复旦大学',
          schoolLocation: '上海',
          college: '计算机科学技术学院',
          major: '电子与通信工程',
          degree: '硕士',
          start: '2019.09',
          end: '2022.06',
          detail: 'GPA 3.8/4.0，研究方向为分布式存储，发表 SCI 论文 1 篇。'
        },
        {
          id: uid('i'),
          school: '浙江科技大学',
          schoolLocation: '杭州',
          college: '信息与电子工程学院',
          major: '财视工程',
          degree: '本科',
          start: '2015.09',
          end: '2019.06',
          detail: '校优秀毕业生，ACM 校赛二等奖。'
        }
      ]
    }),
    mod('work', '工作经历', {
      items: [
        {
          id: uid('i'),
          company: '携程',
          position: 'Java 后端开发工程师',
          time: '2022.07 – 2025.02 · 上海',
          content: `- 负责机票预订核心链路的后端开发与重构，接口平均响应时间从 320ms 降至 120ms。
- 主导短链及服务人群推送平台建设，支撑日均 2 亿+ 消息下发。
- 推动服务容器化与灰度发布，部署效率提升 60%。
- 设计基于标签的人群圈选引擎，支持千万级用户实时分群。
- 搭建全链路压测体系，保障大促期间核心接口稳定性达到 99.99%。
- 带领 4 人小组完成订单中台微服务拆分，解耦历史单体应用。`
        },
        {
          id: uid('i'),
          company: '阿里巴巴',
          position: '高级后端开发工程师',
          time: '2020.03 – 2022.06 · 杭州',
          content: `- 负责商品搜索召回链路优化，CTR 提升 12%。
- 主导缓存架构升级，热点 key 命中率从 82% 提升至 98%。
- 推动多机房容灾方案落地，故障恢复时间缩短至 30 秒内。
- 参与中台化建设，沉淀通用能力 20+ 个，研发效率提升 40%。`
        },
        {
          id: uid('i'),
          company: '某互联网公司',
          position: '后端开发实习生',
          time: '2019.06 – 2019.12 · 北京',
          content: `- 参与订单系统开发与单元测试编写，覆盖率达 85%。
- 协助搭建日志监控平台，问题定位效率提升 50%。`
        }
      ]
    }),
    mod(
      'skills',
      '专业技能',
      {
        markdown: `- **语言与基础**：Java / JVM / 并发编程 / 数据结构与算法 / Python
- **框架与中间件**：Spring / SpringBoot / SpringMVC / MyBatis / Netty
- **存储与消息**：MySQL / Redis / Kafka / RocketMQ / RabbitMQ / Elasticsearch
- **工具与工程**：IDEA / Maven / Tomcat / Git / Docker / Linux / Kubernetes
- **前端相关**：React / Ant Design / TypeScript / Vite
- **其他能力**：高并发系统设计 / 性能调优 / 分布式事务 / 服务治理`
      }
    ),
    mod('projects', '项目经历', {
      items: [
        {
          id: uid('i'),
          name: '短链及服务人群推送平台',
          role: '核心开发',
          start: '2023.06',
          end: '2024.12',
          techStack: 'React / Ant Design / SpringBoot / MyBatis / QMQ / Redis / Hive',
          content: `- **项目描述**：面向营销场景的短链生成与精准人群推送平台，支持活动配置与效果分析。
- 设计短链高可用生成算法，实现基于标签的人群圈选与分级推送策略。
- 构建实时数据流管道，将用户行为毫秒级同步至推荐引擎。
- 落地 A/B 实验框架，支撑运营快速验证活动策略。
- 优化离线计算任务，每日报表产出时间从 3 小时降至 20 分钟。
- 建设多租户隔离方案，保障不同业务线的数据安全与性能。`
        },
        {
          id: uid('i'),
          name: '商品搜索召回优化',
          role: '技术负责人',
          start: '2021.01',
          end: '2022.05',
          techStack: 'Java / Elasticsearch / Flink / Redis',
          content: `- **项目描述**：重构搜索召回链路，引入向量召回与多路召回融合排序。
- 设计特征实时更新机制，保障索引与线上一致性。
- 推动模型在线推理服务化，单次召回耗时下降 45%。
- 搭建召回质量监控大盘，问题召回定位时间缩短 70%。`
        },
        {
          id: uid('i'),
          name: '订单中台微服务拆分',
          role: '架构组成员',
          start: '2024.01',
          end: '2024.10',
          techStack: 'SpringCloud / Dubbo / Nacos / Sentinel',
          content: `- **项目描述**：将历史单体订单系统拆分为 12 个高内聚微服务。
- 制定服务边界与契约，建立灰度发布与熔断降级规范。
- 建设分布式事务方案，强一致场景零资损。
- 推动全链路压测常态化，大促稳定性显著提升。`
        },
        {
          id: uid('i'),
          name: '实时风控决策引擎',
          role: '核心开发',
          start: '2022.03',
          end: '2023.05',
          techStack: 'Flink / Kafka / Redis / Drools',
          content: `- **项目描述**：构建毫秒级实时风控决策引擎，覆盖盗刷、营销作弊等场景。
- 设计规则热更新机制，策略上线从天级降至分钟级。
- 优化特征计算链路，决策平均耗时从 80ms 降至 12ms。
- 建设规则效果回放平台，策略迭代效率提升 3 倍。`
        },
        {
          id: uid('i'),
          name: '数据资产大盘',
          role: '技术负责人',
          start: '2020.06',
          end: '2021.12',
          techStack: 'Vue / ECharts / SpringBoot / ClickHouse',
          content: `- **项目描述**：面向业务线的数据资产可视化平台，统一指标口径与看板。
- 设计指标元数据管理体系，消除跨团队口径歧义。
- 推动自助分析能力，业务方取数自助率提升至 80%。`
        }
      ]
    })
  ]
}
