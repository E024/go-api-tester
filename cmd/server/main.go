package main

import (
	"fmt"
	"go-api-tester/internal/database"
	"go-api-tester/internal/server"
	"log"
)

func main() {
	// 1. 初始化数据库
	if err := database.InitDB(); err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}
	defer database.Close()

	// 2. 创建服务器
	srv := server.NewServer(17780)
	serverUrl := fmt.Sprintf("http://127.0.0.1:%d", srv.Port)

	// 3. 在 Goroutine 中启动 Web 服务 (避免阻塞主线程，因为托盘程序需要占用主线程)
	go func() {
		fmt.Printf("启动 Web 服务: %s\n", serverUrl)
		if err := srv.Start(); err != nil {
			log.Fatalf("服务启动失败: %v", err)
		}
	}()

	// 4. 启动托盘或阻塞主线程 (具体实现在 tray_windows.go 和 tray_default.go)
	runTray(serverUrl)
}