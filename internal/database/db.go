package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite" // 引入纯 Go SQLite 驱动
)

var DB *sql.DB

// InitDB 初始化数据库连接并创建表结构
func InitDB() error {
	// 获取当前执行目录，确保数据库文件生成在程序同级目录下
	ex, err := os.Executable()
	if err != nil {
		return err
	}
	dbPath := filepath.Join(filepath.Dir(ex), "api_tester.db")
	
	// 如果是 go run 运行，os.Executable 可能是临时目录，这里为了开发方便，做个回退判断
	// 在生产环境构建后，上面的逻辑是正确的
	if _, err := os.Stat("go.mod"); err == nil {
		dbPath = "api_tester.db"
	}

	fmt.Printf("正在初始化数据库: %s\n", dbPath)

	var dbErr error
	DB, dbErr = sql.Open("sqlite", dbPath)
	if dbErr != nil {
		return fmt.Errorf("无法打开数据库: %v", dbErr)
	}

	// 验证连接
	if err := DB.Ping(); err != nil {
		return fmt.Errorf("无法连接数据库: %v", err)
	}

	// 启用外键约束
	if _, err := DB.Exec("PRAGMA foreign_keys = ON;"); err != nil {
		return err
	}

	return createTables()
}

func createTables() error {
	schema := `
	CREATE TABLE IF NOT EXISTS collections (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		parent_id INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	-- 修改了 requests 表结构，使用 config 字段存储复杂 JSON
	CREATE TABLE IF NOT EXISTS requests (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		collection_id INTEGER,
		name TEXT NOT NULL,
		method TEXT NOT NULL,
		url TEXT NOT NULL,
		config TEXT, -- 存储 Params, Headers, Auth, Body 的 JSON
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(collection_id) REFERENCES collections(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS mock_rules (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		path_pattern TEXT NOT NULL,
		method TEXT NOT NULL,
		response_body TEXT,
		response_headers TEXT,
		status_code INTEGER DEFAULT 200,
		is_active BOOLEAN DEFAULT 1
	);
	`

	_, err := DB.Exec(schema)
	if err != nil {
		return fmt.Errorf("创建表结构失败: %v", err)
	}

	return nil
}

// Close 关闭数据库连接
func Close() {
	if DB != nil {
		DB.Close()
	}
}