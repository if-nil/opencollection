# OpenCollection 项目结构与近期工作总结

## 1. 项目概述

本项目是一个围绕 **OpenCollection 协议** 的 monorepo，用来描述、校验、展示和运行 API Collection。  
它的目标可以概括为四层：

1. **协议层**：定义 OpenCollection 的数据结构与 JSON Schema
2. **类型层**：提供 TypeScript 类型，方便上层消费
3. **展示层**：把 collection 渲染成 API 文档与交互式 Playground
4. **工具层**：提供 schema 浏览、规范站点、格式转换与示例

---

## 2. 仓库结构

### 2.1 根目录

- `package.json`
  - 使用 npm workspaces 管理多包
- `package-lock.json`
  - 锁定依赖版本
- `main.json`
  - 一个 Bruno/FakeREST 风格的 collection 数据样例
- `examples/`
  - React、Express、standalone HTML 示例
- `packages/`
  - 核心包目录
- `.github/workflows/`
  - CI / E2E 工作流配置

---

## 3. packages 结构说明

### 3.1 `packages/oc-types`
**职责：协议的 TypeScript 类型定义**

主要内容：
- `src/opencollection.ts`
  - OpenCollection 根对象类型
- `src/requests/http.ts`
  - HTTP 请求、Body、Header、Example 等类型
- `src/requests/graphql.ts`
  - GraphQL 请求类型
- `src/requests/grpc.ts`
  - gRPC 请求类型
- `src/requests/websocket.ts`
  - WebSocket 请求类型
- `src/common/`
  - auth、description、scripts、variables 等公共类型
- `src/config/`
  - environments、proxy、protobuf、certificates 等配置类型

它是协议层到展示层之间最重要的“类型桥梁”。

---

### 3.2 `packages/oc-schema`
**职责：OpenCollection 的 JSON Schema**

主要内容：
- `src/opencollection.schema.json`
  - OpenCollection 主 schema
- `src/worspace.schema.json`
  - workspace schema
- `src/index.js`
  - schema 导出入口

这个包主要服务于：
- collection 校验
- 编辑器提示
- schema explorer
- 上层工具的结构约束

---

### 3.3 `packages/oc-docs`
**职责：OpenCollection 文档渲染与交互运行时**

这是当前最核心的应用包，包含：

- **文档渲染**
  - `src/components/Docs/`
  - 渲染 collection 文档、请求详情、示例、代码片段
- **Playground**
  - `src/components/PlaygroundDrawer/`
  - 交互式请求执行与查看响应
- **运行时**
  - `src/runner/`
  - 变量插值、请求执行、断言、脚本处理
- **脚本沙箱**
  - `src/scripting/`
  - QuickJS 沙箱、测试运行与 Bruno 风格脚本对象
- **样例与开发入口**
  - `src/sampleCollection.ts`
  - `src/dev.tsx`
- **测试**
  - `src/*.spec.ts`
  - `e2e/*.spec.ts`

它负责把协议真正“展示出来”和“跑起来”。

---

### 3.4 `packages/oc-converters`
**职责：格式转换**

目前看到的重点是：
- Bruno -> OpenCollection 的转换逻辑

适合作为协议迁移与导入工具。

---

### 3.5 `packages/oc-spec-site`
**职责：规范说明站点**

一个独立的 React/Vite 站点，用来展示 OpenCollection 的规范内容和说明文档。

---

### 3.6 `packages/oc-schema-explorer`
**职责：Schema 可视化浏览器**

用于浏览和理解 JSON Schema 结构，方便开发与调试协议。

---

## 4. 当前架构关系

可以把项目理解为下面这个分层关系：

- `oc-schema`
  - 定义“协议长什么样”
- `oc-types`
  - 定义“代码里怎么表示这个协议”
- `oc-docs`
  - 定义“协议如何被展示和交互执行”
- `oc-converters`
  - 定义“外部格式如何转换进来”
- `oc-spec-site` / `oc-schema-explorer`
  - 定义“如何向开发者解释这个协议”

---

## 5. 本轮工作的总结

本轮围绕 **HTTP RawBody 的字段注释能力** 做了两阶段增强。

### 5.1 第一阶段：为 RawBody 增加 `annotations`

目标：
- 让 `body.type = json` 这类 RawBody 不再只能存一整段原始字符串
- 支持对字段进行单独说明，包含嵌套路径

结果：
- 在协议类型中给 `RawBody` 增加了 `annotations`
- 在 JSON Schema 中增加了对应定义
- 支持路径形式的字段注释，例如：
  - `user.name`
  - `items[].price`

初版示例：

```yaml
body:
  type: json
  data: |
    {
      "user": {
        "name": "Alice"
      }
    }
  annotations:
    user: "用户对象"
    user.name: "用户姓名"
```

---

### 5.2 第二阶段：从“字段说明表”升级到“Body Schema 树”

用户提出两个优化方向：

1. annotation 不应只有描述，还应该能标注字段类型
2. 平铺的 markdown / 路径表格对嵌套结构不够直观

于是做了协议与渲染的进一步调整。

#### 协议增强
新增支持：

```yaml
annotations:
  user:
    dataType: object
    description: 用户对象
  user.name:
    dataType: string
    description: 用户姓名
  items[].price:
    dataType: number
    description: 商品单价
```

兼容策略：
- 旧写法仍保留：
  - 字符串说明
  - 结构化文本说明
- 新写法支持：
  - `dataType`
  - `description`

#### 渲染增强
展示方式从原来的扁平表格改为 **Body Schema 树**：

```text
Body Schema
user        object    用户对象
  name      string    用户姓名
items[]     object    商品项
  price     number    商品单价
```

这样：
- 嵌套关系更直观
- 字段类型更明确
- 更接近常见 API 文档的 schema 展示方式

---

## 6. 涉及的关键改动点

### 协议 / 类型层
- `packages/oc-types/src/requests/http.ts`
  - 为 `RawBody.annotations` 增加支持
  - 引入 `dataType + description` 的 annotation 结构

### Schema 层
- `packages/oc-schema/src/opencollection.schema.json`
  - 增加 `BodyAnnotation` / `BodyAnnotationDetails` / `BodyAnnotationDescription`
  - 支持旧格式与新格式并存

### 展示层
- `packages/oc-docs/src/components/Docs/Item/Item.tsx`
  - 从路径 annotations 构建树结构
  - 渲染 `Body Schema` 树
- `packages/oc-docs/src/components/Docs/Item/StyledWrapper.ts`
  - 补充树形展示样式

### 样例与测试
- `packages/oc-docs/src/sampleCollection.ts`
  - 更新示例 body annotations
- `packages/oc-docs/src/schemaAnnotations.spec.ts`
  - 增加协议层 schema 回归测试
- `packages/oc-docs/e2e/requests.spec.ts`
  - 增加 `Body Schema` 渲染 e2e 覆盖

### 测试环境辅助
- `packages/oc-docs/playwright.config.ts`
  - 增加 `PLAYWRIGHT_PORT` 支持
  - 解决本机已有 3001 服务时，e2e 误连外部页面的问题

---

## 7. 已验证内容

以下内容已经实际验证：

- `npm run build --workspace @opencollection/types`
  - 通过
- `npm run test:run --workspace @opencollection/docs -- src/schemaAnnotations.spec.ts`
  - 通过
- `npm run test:run --workspace @opencollection/docs -- src/dev.spec.ts src/schemaAnnotations.spec.ts`
  - 通过
- `PLAYWRIGHT_PORT=3101 npm run test:e2e --workspace @opencollection/docs -- e2e/requests.spec.ts -g "Request body rendering"`
  - 通过（9 个测试）

---

## 8. 当前已知问题

`@opencollection/docs` 整包 build 仍存在一个**既有类型问题**：

- `packages/oc-docs/src/runner/utils/request-merger.ts`
  - 代码访问了 `request.runtime.auth`
- 但 `HttpRequestRuntime` 类型中没有 `auth`

这会导致：

```bash
npm run build --workspace @opencollection/docs
```

在 TypeScript 声明阶段失败。

这个问题不是本轮 annotations / Body Schema 改动引入的，但它仍然是当前仓库继续推进时需要处理的一个已有阻塞。

---

## 9. 总结

这个项目目前已经具备比较清晰的分层：

- `oc-schema` 定义协议
- `oc-types` 提供类型
- `oc-docs` 完成展示与交互
- `oc-converters` 负责导入转换
- `oc-spec-site` / `oc-schema-explorer` 负责文档化与可视化

而本轮工作完成了一个比较重要的能力升级：

- **从“Raw JSON 只能整段展示”**
- **升级到“字段可带说明、可带类型、可按树结构渲染”**

这让 OpenCollection 在表达 request body 文档时，从“原始文本说明”往“轻量 schema 文档”方向迈进了一步，同时保持了对旧写法的兼容。
