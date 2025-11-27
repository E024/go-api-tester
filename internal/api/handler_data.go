package api

import (
	"encoding/json"
	"fmt"
	"go-api-tester/internal/database"
	"net/http"
	"time"
)

// DataDump 定义导出文件的结构
type DataDump struct {
	Version     string                     `json:"version"`
	ExportedAt  time.Time                  `json:"exported_at"`
	Collections []*database.Collection     `json:"collections"`
	Requests    []*database.Request        `json:"requests"`
	MockRules   []*database.MockRule       `json:"mock_rules"`
}

// HandleExportData 导出所有数据
func HandleExportData(w http.ResponseWriter, r *http.Request) {
	cols, err := database.GetAllCollectionsFlat()
	if err != nil {
		http.Error(w, "Failed to fetch collections", 500)
		return
	}
	reqs, err := database.GetAllRequests()
	if err != nil {
		http.Error(w, "Failed to fetch requests", 500)
		return
	}
	mocks, err := database.GetAllMockRules()
	if err != nil {
		http.Error(w, "Failed to fetch mocks", 500)
		return
	}

	dump := DataDump{
		Version:     "1.0",
		ExportedAt:  time.Now(),
		Collections: cols,
		Requests:    reqs,
		MockRules:   mocks,
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"api_tester_backup_%d.json\"", time.Now().Unix()))
	json.NewEncoder(w).Encode(dump)
}

// HandleImportData 导入数据
func HandleImportData(w http.ResponseWriter, r *http.Request) {
	var dump DataDump
	if err := json.NewDecoder(r.Body).Decode(&dump); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// ID 映射表: OldID -> NewID
	colMap := make(map[int64]int64)

	// 1. 导入分组
	// 简单的拓扑排序策略：多次循环，先插入父节点已存在的（或根节点）
	// 这里的简化版：假设导出是按 ID 排序的，通常父 ID < 子 ID。
	// 如果不是，可能需要多轮尝试。这里为了稳健，采用多轮扫描。
	pendingCols := dump.Collections
	insertedCount := 0
	
	// 最多循环 10 次处理层级嵌套，防止死循环
	for i := 0; i < 10 && len(pendingCols) > 0; i++ {
		var nextPending []*database.Collection
		for _, col := range pendingCols {
			// 如果是根节点 (ParentID=0) 或者 父节点已经映射过
			newParentID := int64(0)
			canInsert := false

			if col.ParentID == 0 {
				canInsert = true
			} else if newID, ok := colMap[col.ParentID]; ok {
				newParentID = newID
				canInsert = true
			}

			if canInsert {
				// 插入并记录映射
				newID, err := database.CreateCollection(col.Name+" (Imported)", newParentID)
				if err == nil {
					colMap[col.ID] = newID
					insertedCount++
				}
			} else {
				nextPending = append(nextPending, col)
			}
		}
		// 如果没有进展，说明有孤儿节点或循环依赖，强制作为根节点插入剩余的
		if len(pendingCols) == len(nextPending) {
			for _, col := range nextPending {
				newID, _ := database.CreateCollection(col.Name+" (Imported-Orphan)", 0)
				colMap[col.ID] = newID
				insertedCount++
			}
			break
		}
		pendingCols = nextPending
	}

	// 2. 导入请求
	reqCount := 0
	for _, req := range dump.Requests {
		// 映射 Collection ID
		newColID := int64(0)
		if req.CollectionID != 0 {
			if mapped, ok := colMap[req.CollectionID]; ok {
				newColID = mapped
			}
		}
		req.CollectionID = newColID
		// 重置 ID 让 DB 生成
		req.ID = 0 
		if _, err := database.CreateRequest(req); err == nil {
			reqCount++
		}
	}

	// 3. 导入 Mock
	mockCount := 0
	for _, rule := range dump.MockRules {
		rule.ID = 0
		if _, err := database.CreateMockRule(rule); err == nil {
			mockCount++
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":     "Import successful",
		"collections": insertedCount,
		"requests":    reqCount,
		"mocks":       mockCount,
	})
}