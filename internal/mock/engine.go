package mock

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"go-api-tester/internal/database"
	"log"
	"net/http"
	"strings"
)

// HandleMockRequest 处理所有以 /mock/ 开头的请求
func HandleMockRequest(w http.ResponseWriter, r *http.Request) {
	// 1. 获取真实路径
	// 假设请求是 /mock/users/123 -> path 应为 /users/123
	// Go 1.22 的 r.PathValue("path") 配合通配符路由使用最佳
	// 这里我们也可以简单地用 TrimPrefix 处理
	path := strings.TrimPrefix(r.URL.Path, "/mock")
	if path == "" || path == "/" {
		http.Error(w, "Mock path required", http.StatusBadRequest)
		return
	}
	// 确保 path 以 / 开头
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	method := r.Method

	// 2. 查找匹配的规则
	rule, err := findMatchingRule(path, method)
	if err != nil {
		if err == sql.ErrNoRows {
			w.WriteHeader(http.StatusNotFound)
			w.Write([]byte(fmt.Sprintf("No mock rule found for [%s] %s", method, path)))
			return
		}
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// 3. 模拟延迟 (可选，未来可配置)
	// time.Sleep(time.Duration(rule.DelayMs) * time.Millisecond)

	// 4. 设置响应头
	for k, v := range rule.ResponseHeaders {
		w.Header().Set(k, v)
	}

	// 5. 设置状态码
	w.WriteHeader(rule.StatusCode)

	// 6. 写入响应体
	w.Write([]byte(rule.ResponseBody))
	
	log.Printf("[MOCK] Matched: [%s] %s -> Status %d", method, path, rule.StatusCode)
}

// findMatchingRule 在数据库中查找规则
// 目前支持精确匹配。未来可扩展支持通配符 (如 /users/*) 或正则
func findMatchingRule(path, method string) (*database.MockRule, error) {
	// 简单精确匹配
	query := `
		SELECT id, path_pattern, method, response_body, response_headers, status_code, is_active 
		FROM mock_rules 
		WHERE path_pattern = ? AND method = ? AND is_active = 1
		LIMIT 1
	`
	
	row := database.DB.QueryRow(query, path, method)

	var r database.MockRule
	var headersStr string
	
	err := row.Scan(&r.ID, &r.PathPattern, &r.Method, &r.ResponseBody, &headersStr, &r.StatusCode, &r.IsActive)
	if err != nil {
		return nil, err
	}

	if headersStr != "" {
		_ = json.Unmarshal([]byte(headersStr), &r.ResponseHeaders)
	}

	return &r, nil
}