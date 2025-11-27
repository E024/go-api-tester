package api

import (
	"encoding/json"
	"go-api-tester/internal/database"
	"net/http"
	"strconv"
)

// HandleListMockRules 获取规则列表
func HandleListMockRules(w http.ResponseWriter, r *http.Request) {
	rules, err := database.GetAllMockRules()
	if err != nil {
		http.Error(w, "Failed to fetch rules: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rules)
}

// HandleCreateMockRule 创建规则
func HandleCreateMockRule(w http.ResponseWriter, r *http.Request) {
	var rule database.MockRule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	if rule.PathPattern == "" {
		http.Error(w, "Path pattern is required", http.StatusBadRequest)
		return
	}
	if rule.StatusCode == 0 {
		rule.StatusCode = 200
	}

	id, err := database.CreateMockRule(&rule)
	if err != nil {
		http.Error(w, "Failed to create rule: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "message": "Mock rule created"})
}

// HandleUpdateMockRule 更新规则
func HandleUpdateMockRule(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	var rule database.MockRule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}
	rule.ID = id

	if err := database.UpdateMockRule(&rule); err != nil {
		http.Error(w, "Failed to update rule: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message": "Mock rule updated"}`))
}

// HandleDeleteMockRule 删除规则
func HandleDeleteMockRule(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	if err := database.DeleteMockRule(id); err != nil {
		http.Error(w, "Failed to delete rule: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message": "Mock rule deleted"}`))
}