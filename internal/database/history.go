package database

import (
	"encoding/json"
	"fmt"
	"time"
)

// HistoryItem 对应数据库 history 表
type HistoryItem struct {
	ID        int64     `json:"id"`
	Method    string    `json:"method"`
	URL       string    `json:"url"`
	Config    string    `json:"-"`       // 内部使用
	Request   *Request  `json:"request"` // 解析后的完整请求数据
	CreatedAt time.Time `json:"created_at"`
}

// CreateHistory 添加历史记录
func CreateHistory(req *Request) (int64, error) {
	configData := map[string]interface{}{
		"params":  req.Params,
		"headers": req.Headers,
		"auth":    req.Auth,
		"body":    req.Body,
	}
	configJSON, err := json.Marshal(configData)
	if err != nil {
		return 0, fmt.Errorf("marshal config failed: %v", err)
	}

	query := `INSERT INTO history (method, url, config, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
	result, err := DB.Exec(query, req.Method, req.URL, string(configJSON))
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

// GetHistory 获取历史记录列表 (按时间倒序，限制最近 100 条)
func GetHistory() ([]*HistoryItem, error) {
	query := `SELECT id, method, url, config, created_at FROM history ORDER BY created_at DESC LIMIT 100`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*HistoryItem
	for rows.Next() {
		item := &HistoryItem{}
		if err := rows.Scan(&item.ID, &item.Method, &item.URL, &item.Config, &item.CreatedAt); err != nil {
			return nil, err
		}

		item.Request = &Request{
			ID:     0,
			Method: item.Method,
			URL:    item.URL,
			Name:   item.URL,
		}

		var configData struct {
			Params  []KeyValue `json:"params"`
			Headers []KeyValue `json:"headers"`
			Auth    AuthConfig `json:"auth"`
			Body    BodyConfig `json:"body"`
		}
		if item.Config != "" {
			_ = json.Unmarshal([]byte(item.Config), &configData)
		}
		item.Request.Params = configData.Params
		item.Request.Headers = configData.Headers
		item.Request.Auth = configData.Auth
		item.Request.Body = configData.Body

		list = append(list, item)
	}
	return list, nil
}

// [新增] DeleteHistoryItem 删除单条历史
func DeleteHistoryItem(id int64) error {
	_, err := DB.Exec("DELETE FROM history WHERE id = ?", id)
	return err
}

// [新增] DeleteHistoryByDate 删除某天的历史
func DeleteHistoryByDate(dateStr string) error {
	// SQLite 使用 date() 函数截取日期部分进行比较
	// dateStr 格式应为 YYYY-MM-DD
	_, err := DB.Exec("DELETE FROM history WHERE date(created_at) = ?", dateStr)
	return err
}

// ClearHistory 清空所有历史
func ClearHistory() error {
	_, err := DB.Exec("DELETE FROM history")
	return err
}
