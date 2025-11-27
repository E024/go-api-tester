package database

import (
	"time"
)

// Collection 对应数据库 collections 表
type Collection struct {
	ID        int64         `json:"id"`
	Name      string        `json:"name"`
	ParentID  int64         `json:"parent_id"` // 0 表示根节点
	CreatedAt time.Time     `json:"created_at"`
	Children  []*Collection `json:"children,omitempty"` // 用于构建树状结构
}

// CreateCollection 创建新分组
func CreateCollection(name string, parentID int64) (int64, error) {
	query := "INSERT INTO collections (name, parent_id) VALUES (?, ?)"
	result, err := DB.Exec(query, name, parentID)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

// DeleteCollection 删除分组
func DeleteCollection(id int64) error {
	query := "DELETE FROM collections WHERE id = ?"
	_, err := DB.Exec(query, id)
	return err
}

// GetAllCollections 获取所有分组并组装成树状结构 (用于前端展示)
func GetAllCollections() ([]*Collection, error) {
	flat, err := GetAllCollectionsFlat()
	if err != nil {
		return nil, err
	}

	// 组装树状结构
	lookup := make(map[int64]*Collection)
	for _, c := range flat {
		lookup[c.ID] = c
	}

	var root []*Collection
	for _, c := range flat {
		if c.ParentID == 0 {
			root = append(root, c)
		} else {
			if parent, ok := lookup[c.ParentID]; ok {
				parent.Children = append(parent.Children, c)
			} else {
				// 孤儿节点作为根节点
				root = append(root, c)
			}
		}
	}

	return root, nil
}

// GetAllCollectionsFlat 获取所有分组（扁平结构，用于导出）
func GetAllCollectionsFlat() ([]*Collection, error) {
	rows, err := DB.Query("SELECT id, name, parent_id, created_at FROM collections ORDER BY id ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*Collection
	for rows.Next() {
		c := &Collection{}
		if err := rows.Scan(&c.ID, &c.Name, &c.ParentID, &c.CreatedAt); err != nil {
			return nil, err
		}
		c.Children = []*Collection{} // 初始化为空切片
		list = append(list, c)
	}
	return list, nil
}