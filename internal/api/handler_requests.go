package api

import (
	"encoding/json"
	"go-api-tester/internal/database"
	"net/http"
	"strconv"
)

// HandleListRequests 获取所有请求列表
func HandleListRequests(w http.ResponseWriter, r *http.Request) {
	requests, err := database.GetAllRequests()
	if err != nil {
		http.Error(w, "Failed to fetch requests: "+err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(requests)
}

// HandleGetRequest 获取单个请求
func HandleGetRequest(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	req, err := database.GetRequest(id)
	if err != nil {
		http.Error(w, "Request not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(req)
}

// HandleCreateRequest 创建请求 (POST)
func HandleCreateRequest(w http.ResponseWriter, r *http.Request) {
	var req database.Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "Name is required", http.StatusBadRequest)
		return
	}

	id, err := database.CreateRequest(&req)
	if err != nil {
		http.Error(w, "Failed to create request: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id": id, 
		"message": "Request saved successfully",
	})
}

// HandleUpdateRequest 更新请求 (PUT)
func HandleUpdateRequest(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	var req database.Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}
	
	req.ID = id // 确保 ID 一致

	if err := database.UpdateRequest(&req); err != nil {
		http.Error(w, "Failed to update request: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message": "Request updated successfully"}`))
}

// HandleDeleteRequest 删除请求
func HandleDeleteRequest(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	if err := database.DeleteRequest(id); err != nil {
		http.Error(w, "Failed to delete request: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message": "Request deleted"}`))
}