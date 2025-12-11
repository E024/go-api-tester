package api

import (
	"encoding/json"
	"go-api-tester/internal/database"
	"net/http"
	"strconv"
)

// HandleGetHistory 获取历史列表
func HandleGetHistory(w http.ResponseWriter, r *http.Request) {
	history, err := database.GetHistory()
	if err != nil {
		http.Error(w, "Failed to fetch history", 500)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(history)
}

// HandleCreateHistory 创建历史
func HandleCreateHistory(w http.ResponseWriter, r *http.Request) {
	var req database.Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	id, err := database.CreateHistory(&req)
	if err != nil {
		http.Error(w, "Failed to save history", 500)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id})
}

// HandleDeleteHistory 处理删除历史 (支持 单条、按日期、全部)
func HandleDeleteHistory(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	idStr := query.Get("id")
	dateStr := query.Get("date")

	var err error

	if idStr != "" {
		// 1. 按 ID 删除
		var id int64
		id, err = strconv.ParseInt(idStr, 10, 64)
		if err == nil {
			err = database.DeleteHistoryItem(id)
		}
	} else if dateStr != "" {
		// 2. 按日期删除 (格式: YYYY-MM-DD)
		err = database.DeleteHistoryByDate(dateStr)
	} else {
		// 3. 默认：清空所有历史
		err = database.ClearHistory()
	}

	if err != nil {
		http.Error(w, "Failed to delete history: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message": "History deleted successfully"}`))
}
