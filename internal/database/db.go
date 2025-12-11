package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

// InitDB 初始化数据库连接并创建表结构
func InitDB() error {
	ex, err := os.Executable()
	if err != nil {
		return err
	}
	dbPath := filepath.Join(filepath.Dir(ex), "api_tester.db")

	if _, err := os.Stat("go.mod"); err == nil {
		dbPath = "api_tester.db"
	}

	fmt.Printf("正在初始化数据库: %s\n", dbPath)

	var dbErr error
	DB, dbErr = sql.Open("sqlite", dbPath)
	if dbErr != nil {
		return fmt.Errorf("无法打开数据库: %v", dbErr)
	}

	if err := DB.Ping(); err != nil {
		return fmt.Errorf("无法连接数据库: %v", err)
	}

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

	CREATE TABLE IF NOT EXISTS requests (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		collection_id INTEGER,
		name TEXT NOT NULL,
		method TEXT NOT NULL,
		url TEXT NOT NULL,
		config TEXT,
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

	-- [新增] 历史记录表
	CREATE TABLE IF NOT EXISTS history (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		method TEXT NOT NULL,
		url TEXT NOT NULL,
		config TEXT, -- 存储完整请求配置
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`

	_, err := DB.Exec(schema)
	if err != nil {
		return fmt.Errorf("创建表结构失败: %v", err)
	}

	return nil
}

func Close() {
	if DB != nil {
		DB.Close()
	}
}
