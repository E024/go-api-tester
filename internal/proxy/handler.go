package proxy

import (
	"encoding/json"
	"net/http"
)

// HandleSend 处理 /api/proxy/send 路由
func HandleSend(w http.ResponseWriter, r *http.Request) {
	// 1. 设置响应头为 JSON
	w.Header().Set("Content-Type", "application/json")

	// 2. 解析请求体
	var req ProxyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ProxyResponse{
			Error: "Invalid JSON format: " + err.Error(),
		})
		return
	}

	// 3. 调用核心服务
	// 这一步是同步调用的，如果请求很慢，这里会阻塞。
	// 对于本地工具来说通常是可以接受的。
	resp := SendRequest(req)

	// 4. 返回结果
	// 注意：这里我们始终返回 200 OK (除非 JSON 解析失败)，
	// 真正的目标服务器状态码在 resp.StatusCode 中。
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		// 如果写入 JSON 失败，通常意味着连接已断开，记录日志即可
		// 这里暂不处理
	}
}