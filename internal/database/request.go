package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// ... (结构体定义保持不变) ...
type KeyValue struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Description string `json:"description"`
	Enabled     bool   `json:"enabled"`
	Type        string `json:"type,omitempty"`
}

type AuthConfig struct {
	Type   string            `json:"type"`
	Basic  map[string]string `json:"basic,omitempty"`
	Bearer map[string]string `json:"bearer,omitempty"`
	APIKey map[string]string `json:"apikey,omitempty"`
}

type BodyConfig struct {
	Type         string     `json:"type"`
	RawType      string     `json:"raw_type,omitempty"`
	RawContent   string     `json:"raw_content,omitempty"`
	FormData     []KeyValue `json:"form_data,omitempty"`
	UrlEncoded   []KeyValue `json:"url_encoded,omitempty"`
	BinaryPath   string     `json:"binary_path,omitempty"`
	GraphQLQuery string     `json:"graphql_query,omitempty"`
	GraphQLVars  string     `json:"graphql_vars,omitempty"`
}

type Request struct {
	ID           int64      `json:"id"`
	CollectionID int64      `json:"collection_id"`
	Name         string     `json:"name"`
	Method       string     `json:"method"`
	URL          string     `json:"url"`
	Params       []KeyValue `json:"params"`
	Headers      []KeyValue `json:"headers"`
	Auth         AuthConfig `json:"auth"`
	Body         BodyConfig `json:"body"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type requestDBModel struct {
	ID           int64
	CollectionID sql.NullInt64 // [修改] 使用 NullInt64 处理可能的 NULL
	Name         string
	Method       string
	URL          string
	Config       string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// CreateRequest 创建新请求
func CreateRequest(req *Request) (int64, error) {
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

	// [修复] 处理 CollectionID: 如果是 0，存为 NULL
	var colID interface{}
	if req.CollectionID == 0 {
		colID = nil
	} else {
		colID = req.CollectionID
	}

	query := `INSERT INTO requests (collection_id, name, method, url, config, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
	
	result, err := DB.Exec(query, colID, req.Name, req.Method, req.URL, string(configJSON))
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

// UpdateRequest 更新现有请求
func UpdateRequest(req *Request) error {
	configData := map[string]interface{}{
		"params":  req.Params,
		"headers": req.Headers,
		"auth":    req.Auth,
		"body":    req.Body,
	}
	configJSON, _ := json.Marshal(configData)

	// [修复] 处理 CollectionID
	var colID interface{}
	if req.CollectionID == 0 {
		colID = nil
	} else {
		colID = req.CollectionID
	}

	query := `
		UPDATE requests 
		SET collection_id=?, name=?, method=?, url=?, config=?, updated_at=CURRENT_TIMESTAMP
		WHERE id=?
	`
	_, err := DB.Exec(query, colID, req.Name, req.Method, req.URL, string(configJSON), req.ID)
	return err
}

// GetRequest 获取单个请求详情
func GetRequest(id int64) (*Request, error) {
	query := `SELECT id, collection_id, name, method, url, config, created_at, updated_at FROM requests WHERE id = ?`
	row := DB.QueryRow(query, id)

	var dbReq requestDBModel
	err := row.Scan(&dbReq.ID, &dbReq.CollectionID, &dbReq.Name, &dbReq.Method, &dbReq.URL, &dbReq.Config, &dbReq.CreatedAt, &dbReq.UpdatedAt)
	if err != nil {
		return nil, err
	}

	req := &Request{
		ID:           dbReq.ID,
		// [修复] 如果 DB 里是 NULL，转回 0 给前端
		CollectionID: 0, 
		Name:         dbReq.Name,
		Method:       dbReq.Method,
		URL:          dbReq.URL,
		CreatedAt:    dbReq.CreatedAt,
		UpdatedAt:    dbReq.UpdatedAt,
	}
	if dbReq.CollectionID.Valid {
		req.CollectionID = dbReq.CollectionID.Int64
	}

	var configData struct {
		Params  []KeyValue `json:"params"`
		Headers []KeyValue `json:"headers"`
		Auth    AuthConfig `json:"auth"`
		Body    BodyConfig `json:"body"`
	}
	if dbReq.Config != "" {
		_ = json.Unmarshal([]byte(dbReq.Config), &configData)
	}
	
	req.Params = configData.Params
	req.Headers = configData.Headers
	req.Auth = configData.Auth
	req.Body = configData.Body

	return req, nil
}

// DeleteRequest 保持不变
func DeleteRequest(id int64) error {
	_, err := DB.Exec("DELETE FROM requests WHERE id = ?", id)
	return err
}

// GetAllRequests 获取所有请求
func GetAllRequests() ([]*Request, error) {
	query := `SELECT id, collection_id, name, method, url, config, created_at, updated_at FROM requests ORDER BY updated_at DESC`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*Request
	for rows.Next() {
		var dbReq requestDBModel
		if err := rows.Scan(&dbReq.ID, &dbReq.CollectionID, &dbReq.Name, &dbReq.Method, &dbReq.URL, &dbReq.Config, &dbReq.CreatedAt, &dbReq.UpdatedAt); err != nil {
			return nil, err
		}

		req := &Request{
			ID:           dbReq.ID,
			CollectionID: 0,
			Name:         dbReq.Name,
			Method:       dbReq.Method,
			URL:          dbReq.URL,
			CreatedAt:    dbReq.CreatedAt,
			UpdatedAt:    dbReq.UpdatedAt,
		}
		if dbReq.CollectionID.Valid {
			req.CollectionID = dbReq.CollectionID.Int64
		}
		
		var configData struct {
			Params  []KeyValue `json:"params"`
			Headers []KeyValue `json:"headers"`
			Auth    AuthConfig `json:"auth"`
			Body    BodyConfig `json:"body"`
		}
		if dbReq.Config != "" {
			_ = json.Unmarshal([]byte(dbReq.Config), &configData)
		}
		req.Params = configData.Params
		req.Headers = configData.Headers
		req.Auth = configData.Auth
		req.Body = configData.Body

		list = append(list, req)
	}
	return list, nil
}