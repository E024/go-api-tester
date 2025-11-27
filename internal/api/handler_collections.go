package api

import (
	"encoding/json"
	"go-api-tester/internal/database"
	"net/http"
	"strconv"
)

// HandleGetCollections 获取分组树
func HandleGetCollections(w http.ResponseWriter, r *http.Request) {
	collections, err := database.GetAllCollections()
	if err != nil {
		http.Error(w, "Failed to get collections: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(collections)
}

// CreateCollectionRequest 定义创建请求的 Body
type CreateCollectionRequest struct {
	Name     string `json:"name"`
	ParentID int64  `json:"parent_id"`
}

// HandleCreateCollection 创建分组
func HandleCreateCollection(w http.ResponseWriter, r *http.Request) {
	var req CreateCollectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "Name is required", http.StatusBadRequest)
		return
	}

	id, err := database.CreateCollection(req.Name, req.ParentID)
	if err != nil {
		http.Error(w, "Failed to create collection: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":      id,
		"message": "Collection created successfully",
	})
}

// HandleDeleteCollection 删除分组
// 路径参数通常需要通过 r.PathValue (Go 1.22+) 获取
func HandleDeleteCollection(w http.ResponseWriter, r *http.Request) {
	// 获取路径参数 {id}
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	if err := database.DeleteCollection(id); err != nil {
		http.Error(w, "Failed to delete collection: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message": "Collection deleted"}`))
}