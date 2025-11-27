# **Go API Tester**

**Go API Tester** 是一款类似 Postman/Apifox 的轻量级、私有化 API 调试与管理工具。

它采用 **B/S 架构** 的变体设计：后端使用 Golang 提供强大的网络代理和数据存储能力，前端使用纯原生 HTML/JS/CSS 构建。最终编译为**单个可执行文件**，双击即用，数据存储在本地 SQLite 中，并在 Windows 平台支持**系统托盘驻留**和后台运行。

*(请在此处替换为实际的应用截图)*

## **✨ 核心功能**

### **🚀 API 调试**

* **多协议支持**：支持 GET, POST, PUT, DELETE, PATCH 等标准 HTTP 方法。  
* **请求构建**：  
  * 支持 Query Params 自动与 URL 同步。  
  * Body 支持：none, form-data, x-www-form-urlencoded, raw (JSON/XML/Text)。  
  * Auth 支持：Basic Auth, Bearer Token。  
* **响应处理**：  
  * **智能视图**：自动识别 JSON 并格式化，支持 HTML 预览、图片预览。  
  * **Hex 视图**：支持二进制数据的十六进制查看。  
  * **Gzip 解压**：自动处理 Gzip 压缩的响应流。

### **🎭 高级 Mock 服务**

* **本地 Mock 服务器**：内置高性能 Mock 引擎。  
* **规则管理**：支持自定义 Path、Method、Status Code、Response Headers 和 Body。  
* **无缝切换**：请求发送时一键勾选 "Use Mock"，自动将请求转发至本地 Mock 引擎。

### **📂 数据管理**

* **分组管理**：支持多级文件夹嵌套，拖拽移动请求归类。  
* **导入导出**：支持 JSON 格式的全量数据备份与迁移，支持智能合并与冲突更新。  
* **另存为**：支持“更新当前请求”或“另存为新请求”。

### **🖥️ 系统集成**

* **单文件分发**：前端资源通过 embed 打包进二进制文件。  
* **Windows 托盘**：关闭窗口后缩小至托盘，支持右键菜单控制。  
* **原生体验**：自动打开默认浏览器，无多余控制台窗口（Release 模式）。

## **🛠️ 开发指南**

### **环境要求**

* **Go**: 1.22 或更高版本 (使用了 http.ServeMux 的新特性)。  
* **GCC**: Windows 下编译必须安装 GCC (推荐 **TDM-GCC** 或 **MinGW-w64**)，因为 systray 和 sqlite 库依赖 CGO。

### **项目结构**

go-api-tester/  
├── cmd/  
│   └── server/          \# 程序入口  
│       ├── main.go      \# 主逻辑  
│       ├── tray\_windows.go \# Windows 托盘实现  
│       └── tray\_default.go \# 其他系统兼容实现  
├── internal/  
│   ├── api/             \# 业务接口 Handler  
│   ├── database/        \# SQLite 数据操作层  
│   ├── mock/            \# Mock 引擎核心  
│   ├── proxy/           \# HTTP 代理发送核心  
│   └── server/          \# HTTP Server 路由配置  
├── web/                 \# 前端静态资源 (HTML/CSS/JS)  
├── build\_release.bat    \# Windows 打包脚本  
├── versioninfo.json     \# Windows 版本信息配置  
├── icon.ico             \# 应用图标  
└── go.mod

### **本地运行**

在开发模式下，你可以直接运行：

go run ./cmd/server

*注意：使用 ./cmd/server 路径以确保包含该目录下的所有 OS 特定文件。*

## **📦 构建与发布 (Windows)**

本项目针对 Windows 做了深度优化（图标、版本信息、去除黑窗口、托盘图标）。

### **准备工作**

1. 确保根目录下有 icon.ico 图标文件。  
2. 安装构建辅助工具：  
   go install \[github.com/josephspurrier/goversioninfo/cmd/goversioninfo@latest\](https://github.com/josephspurrier/goversioninfo/cmd/goversioninfo@latest)

### **一键打包**

直接运行根目录下的批处理脚本：

build\_release.bat  
