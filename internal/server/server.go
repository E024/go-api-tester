package server

import (
	"fmt"
	"go-api-tester/internal/api"
	"go-api-tester/internal/mock"
	"go-api-tester/internal/proxy"
	"go-api-tester/web"
	"net/http"
)

// Server 结构体用于管理 HTTP 服务
type Server struct {
	Port int
	Mux  *http.ServeMux
}

// NewServer 创建一个新的 Server 实例
func NewServer(port int) *Server {
	return &Server{
		Port: port,
		Mux:  http.NewServeMux(),
	}
}

// Start 启动 HTTP 服务
func (s *Server) Start() error {
	// 1. 配置路由
	s.routes()

	addr := fmt.Sprintf("127.0.0.1:%d", s.Port)
	serverUrl := fmt.Sprintf("http://%s", addr)

	// [修改] 移除此处自动打开浏览器的逻辑
	// 浏览器的打开由 cmd/server/main.go 中的 runTray 统一管理
	// 这样可以避免在 Windows 下出现打开两次的情况（一次由 Server Start，一次由 Tray onReady）

	fmt.Printf("服务已启动，监听地址: %s\n", serverUrl)
	// 3. 开始监听
	return http.ListenAndServe(addr, s.Mux)
}

// routes 注册所有路由
func (s *Server) routes() {
	// --- 静态资源路由 ---
	fileServer := http.FileServer(http.FS(web.Assets))
	// [修复] 将 "GET /" 改为 "/" 以避免与 "/mock/" (匹配所有方法) 发生冲突
	s.Mux.Handle("/", fileServer)
	s.Mux.Handle("GET /index.html", fileServer)

	// --- API 路由 ---
	s.Mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status": "ok", "message": "Service is running"}`))
	})

	// 代理服务
	s.Mux.HandleFunc("POST /api/proxy/send", proxy.HandleSend)

	// 分组管理
	s.Mux.HandleFunc("GET /api/collections", api.HandleGetCollections)
	s.Mux.HandleFunc("POST /api/collections", api.HandleCreateCollection)
	s.Mux.HandleFunc("DELETE /api/collections/{id}", api.HandleDeleteCollection)

	// 请求管理
	s.Mux.HandleFunc("GET /api/requests", api.HandleListRequests)
	s.Mux.HandleFunc("POST /api/requests", api.HandleCreateRequest)
	s.Mux.HandleFunc("GET /api/requests/{id}", api.HandleGetRequest)
	s.Mux.HandleFunc("PUT /api/requests/{id}", api.HandleUpdateRequest)
	s.Mux.HandleFunc("DELETE /api/requests/{id}", api.HandleDeleteRequest)

	// Mock 规则管理
	s.Mux.HandleFunc("GET /api/mocks", api.HandleListMockRules)
	s.Mux.HandleFunc("POST /api/mocks", api.HandleCreateMockRule)
	s.Mux.HandleFunc("PUT /api/mocks/{id}", api.HandleUpdateMockRule)
	s.Mux.HandleFunc("DELETE /api/mocks/{id}", api.HandleDeleteMockRule)

	// 数据导入导出
	s.Mux.HandleFunc("GET /api/export", api.HandleExportData)
	s.Mux.HandleFunc("POST /api/import", api.HandleImportData)

	// 动态 Mock 服务 (匹配所有 /mock/ 开头的请求)
	s.Mux.HandleFunc("/mock/", mock.HandleMockRequest)
}