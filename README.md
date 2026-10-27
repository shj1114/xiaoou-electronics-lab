# 小欧电子实验室

《电子产品装调》课程项目“毫欧电阻分选仪的制作与调试”的在线学习网站。

**公开访问：[https://shj1114.github.io/xiaoou-electronics-lab/](https://shj1114.github.io/xiaoou-electronics-lab/)**

电脑与手机浏览器均可使用，不需要安装软件，不需要登录 GitHub。

## 如何连接 DeepSeek

1. 点击网站右上角 **连接 DeepSeek**。
2. 在弹窗中点击 **获取 Key**，前往 [DeepSeek 开放平台](https://platform.deepseek.com/api_keys) 创建自己的 API Key。
3. 粘贴 Key，点击 **测试连接**，选择账户可用模型后点击 **保存并开始**。

不配置 Key 也可以检索课程资料、查看图纸、使用仿真和自测。Key 默认只保存在当前页面内存；勾选“在这台设备记住 Key”才会写入本机浏览器存储，可随时删除。Key 不上传 GitHub，不共享给其他访客。调用 DeepSeek 时会发送问题、近期对话与检索出的课程证据，费用由使用者自己的账户承担。答案复核开启时，每轮问答通常调用两次模型。

模型默认使用 DeepSeek 官方文档所列 `deepseek-flash`；另提供 `deepseek-v4-pro`。测试连接后按接口返回刷新可用模型列表。接口地址固定为 `https://api.deepseek.com`，无需自行填写地址或安装后端。

## 网站功能

- AI 课程问答：检索课程证据、大模型解释、可选的二次复核、可点击的原文引用、停止生成、复制与导出学习笔记。
- 课程知识库：197 条带出处的知识片段，可搜索和按类别筛选；保留原版 41 个完整专题。
- 实训路线：7 个任务对应 9 学时，记录个人完成进度。勾选不是教师验收或正式成绩。
- 测量仿真：调整电流、阻值、增益、引线电阻和阈值，对比两线/四线理论结果。理想仿真未模拟滞回、时延、热电势和真实硬件饱和。
- 随堂自测：6 道核心题，自动评分、解释与来源索引。
- 资料与导学：项目报告、三张图纸、器件手册和 6 节语音讲解。

课程报告里的设计要求、参考结论与实际测量结果严格区分。模型复核能帮助发现错误，不能替代标准器校准、真实测量或教师验收。

## 本地预览与测试

本网站是静态网页，直接双击 HTML 时浏览器可能限制知识库读取。使用任意静态服务器，例如：

```sh
python -m http.server 8080
```

然后访问 `http://localhost:8080`。核心逻辑测试无第三方依赖：

```sh
node --test tests/*.test.js
```

## GitHub Pages 发布

仓库已有的 `.github/workflows/pages.yml` 会把根目录的 `小欧实训室_GitHubPages_网站包.zip` 解压后发布到 Pages，推送同名新包会自动触发部署。本次沿用该流程，并在仓库中提供可直接编辑的 HTML、CSS、JavaScript 和测试文件。

更新源码后重新生成网站包：

```sh
python tools/package_site.py
```

将更新过的源码和同名网站包一起提交到 `main`。前往仓库 Actions，等待 **Publish Xiaoou learning site** 成功。若浏览器仍显示旧版，刷新页面或清除该站点缓存。

## 技术资料

- [DeepSeek 首次调用 API](https://api-docs.deepseek.com/zh-cn/)
- [Keithley Low Level Measurements Handbook 第7版](https://download.tek.com/document/LowLevelHandbook_7Ed.pdf)：低阻引线与四线法、干电路测试。
- [ADI ICL7106/ICL7107 数据手册](https://www.analog.com/media/en/technical-documentation/data-sheets/ICL7106-ICL7107.pdf)：满量程与参考电压配置。

完整原版内容保留在 `classic/`，原有知识库地址 `knowledge.html` 仍可打开。未新增广告、统计追踪或公共共享模型密钥。
