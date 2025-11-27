package database

import (
	"encoding/json"
	"fmt"
)

// MockRule 对应数据库 mock_rules 表
type MockRule struct {
	ID              int64             `json:"id"`
	PathPattern     string            `json:"path_pattern"`     // 匹配路径，例如 /users/123
	Method          string            `json:"method"`           // HTTP 方法
	ResponseBody    string            `json:"response_body"`    // 模拟返回的 Body
	ResponseHeaders map[string]string `json:"response_headers"` // 模拟返回的 Headers
	StatusCode      int               `json:"status_code"`      // 模拟状态码
	IsActive        bool              `json:"is_active"`        // 开关
}

// CreateMockRule 创建规则
func CreateMockRule(rule *MockRule) (int64, error) {
	headersJSON, err := json.Marshal(rule.ResponseHeaders)
	if err != nil {
		return 0, fmt.Errorf("marshal headers failed: %v", err)
	}

	query := `
		INSERT INTO mock_rules (path_pattern, method, response_body, response_headers, status_code, is_active)
		VALUES (?, ?, ?, ?, ?, ?)
	`
	result, err := DB.Exec(query, rule.PathPattern, rule.Method, rule.ResponseBody, string(headersJSON), rule.StatusCode, rule.IsActive)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

// UpdateMockRule 更新规则
func UpdateMockRule(rule *MockRule) error {
	headersJSON, err := json.Marshal(rule.ResponseHeaders)
	if err != nil {
		return fmt.Errorf("marshal headers failed: %v", err)
	}

	query := `
		UPDATE mock_rules 
		SET path_pattern=?, method=?, response_body=?, response_headers=?, status_code=?, is_active=?
		WHERE id=?
	`
	_, err = DB.Exec(query, rule.PathPattern, rule.Method, rule.ResponseBody, string(headersJSON), rule.StatusCode, rule.IsActive, rule.ID)
	return err
}

// GetMockRule 获取单个规则
func GetMockRule(id int64) (*MockRule, error) {
	query := `SELECT id, path_pattern, method, response_body, response_headers, status_code, is_active FROM mock_rules WHERE id = ?`
	row := DB.QueryRow(query, id)

	var r MockRule
	var headersStr string
	
	err := row.Scan(&r.ID, &r.PathPattern, &r.Method, &r.ResponseBody, &headersStr, &r.StatusCode, &r.IsActive)
	if err != nil {
		return nil, err
	}

	if headersStr != "" {
		_ = json.Unmarshal([]byte(headersStr), &r.ResponseHeaders)
	}
	if r.ResponseHeaders == nil {
		r.ResponseHeaders = make(map[string]string)
	}

	return &r, nil
}

// DeleteMockRule 删除规则
func DeleteMockRule(id int64) error {
	_, err := DB.Exec("DELETE FROM mock_rules WHERE id = ?", id)
	return err
}

// GetAllMockRules 获取所有规则
func GetAllMockRules() ([]*MockRule, error) {
	query := `SELECT id, path_pattern, method, response_body, response_headers, status_code, is_active FROM mock_rules ORDER BY id DESC`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*MockRule
	for rows.Next() {
		var r MockRule
		var headersStr string
		if err := rows.Scan(&r.ID, &r.PathPattern, &r.Method, &r.ResponseBody, &headersStr, &r.StatusCode, &r.IsActive); err != nil {
			return nil, err
		}
		
		if headersStr != "" {
			_ = json.Unmarshal([]byte(headersStr), &r.ResponseHeaders)
		}
		if r.ResponseHeaders == nil {
			r.ResponseHeaders = make(map[string]string)
		}

		list = append(list, &r)
	}
	return list, nil
}